/**
 * Scryfall Local Search Route
 * ---------------------------
 * Serves local search results from the cached bulk data file.
 * Uses Fuse.js for fuzzy name matching.
 * Deduplicates by oracle_id (so each unique card text appears only once).
 * 
 *  Exact name match prioritized
 *  Avoids Secret Lair / promo / alt-art printings
 *  Only returns one canonical version per oracle_id
 */

import express from "express";
import Fuse from "fuse.js";
import { loadCardData } from "../services/scryfallUpdater.js";

const router = express.Router();

// ----------------------------------------------------
// Load all cards from local cache
// ----------------------------------------------------
let allCards = [];
let dedupedCards = [];
let fuse;
let oracleGroups = new Map();
let nameToOracle = new Map();
let nameToCardMap = new Map();
let oracleToPrintingsMap = new Map();

let loadPromise = null;

export async function reloadLocalScryfall(force = false) {
  if (loadPromise && !force) {
    return loadPromise;
  }
  loadPromise = (async () => {
    allCards = await loadCardData();
// console.log(` ScryfallLocal loaded ${allCards.length.toLocaleString()} cards from bulk data.`);

    const groups = new Map();
    nameToOracle.clear();

    for (const card of allCards) {
      const oracle = card.oracle_id || card.name?.toLowerCase() || card.id;
      if (!oracle) continue;
      if (!groups.has(oracle)) groups.set(oracle, []);
      groups.get(oracle).push(card);

      if (card.name) {
        const fullLower = card.name.toLowerCase();
        nameToOracle.set(fullLower, oracle);
        if (card.name.includes(" // ")) {
          const parts = card.name.split(" // ");
          if (parts[0]) nameToOracle.set(parts[0].trim().toLowerCase(), oracle);
          if (parts[1]) nameToOracle.set(parts[1].trim().toLowerCase(), oracle);
        }
      }
      if (Array.isArray(card.card_faces)) {
        for (const face of card.card_faces) {
          if (face?.name) {
            nameToOracle.set(face.name.toLowerCase(), oracle);
          }
        }
      }
    }

    oracleGroups = groups;
    dedupedCards = [];
    nameToCardMap.clear();
    oracleToPrintingsMap.clear();

    for (const [oracle, cards] of groups.entries()) {
      const filtered = cards.filter((c) => {
        const layout = c.layout || "";
        if (layout.includes("token") || layout.includes("art_series")) return false;
        return (
          c.image_uris?.normal ||
          c.image_uris?.small ||
          c.card_faces?.[0]?.image_uris?.normal ||
          c.card_faces?.[0]?.image_uris?.small
        );
      });

      if (filtered.length === 0) continue;

      filtered.sort((a, b) => {
        const dateA = a.released_at ? new Date(a.released_at) : new Date(0);
        const dateB = b.released_at ? new Date(b.released_at) : new Date(0);

        if (dateB - dateA !== 0) return dateB - dateA;

        const isSecretLairA = a.set?.toLowerCase() === "sld" || a.set_name?.toLowerCase().includes("secret lair");
        const isSecretLairB = b.set?.toLowerCase() === "sld" || b.set_name?.toLowerCase().includes("secret lair");
        if (isSecretLairA !== isSecretLairB) return isSecretLairA ? 1 : -1;

        const promoA = a.promo || a.full_art || a.border_color === "borderless";
        const promoB = b.promo || b.full_art || b.border_color === "borderless";
        if (promoA !== promoB) return promoA ? 1 : -1;

        const numA = parseInt(a.collector_number) || 0;
        const numB = parseInt(b.collector_number) || 0;
        return numB - numA;
      });

      const canonicalCard = filtered[0];
      dedupedCards.push(canonicalCard);

      const formattedPrints = cards
        .slice()
        .sort((a, b) => new Date(b.released_at || 0) - new Date(a.released_at || 0))
        .map(p => ({
          set: p.set,
          set_name: p.set_name,
          collector_number: p.collector_number,
          prices: p.prices,
          released_at: p.released_at,
          image_uris: p.image_uris,
          card_faces: p.card_faces,
          layout: p.layout,
          border_color: p.border_color,
          frame_effects: p.frame_effects,
          promo_types: p.promo_types,
          full_art: p.full_art,
          finishes: p.finishes,
        }));

      oracleToPrintingsMap.set(oracle, formattedPrints);
    }

    for (const card of dedupedCards) {
      if (card.name) {
        const fullLower = card.name.toLowerCase();
        nameToCardMap.set(fullLower, card);
        if (card.name.includes(" // ")) {
          const parts = card.name.split(" // ");
          if (parts[0]) {
            const frontLower = parts[0].trim().toLowerCase();
            if (!nameToCardMap.has(frontLower)) nameToCardMap.set(frontLower, card);
          }
          if (parts[1]) {
            const backLower = parts[1].trim().toLowerCase();
            if (!nameToCardMap.has(backLower)) nameToCardMap.set(backLower, card);
          }
        }
      }
      if (Array.isArray(card.card_faces)) {
        for (const face of card.card_faces) {
          if (face?.name) {
            const faceLower = face.name.toLowerCase();
            if (!nameToCardMap.has(faceLower)) nameToCardMap.set(faceLower, card);
          }
        }
      }
    }

    fuse = new Fuse(dedupedCards, {
      keys: ["name", "card_faces.name"],
      threshold: 0.2,
      ignoreLocation: true,
      minMatchCharLength: 3,
    });
  })();

  return loadPromise;
}

export async function ensureLoaded() {
  if (loadPromise) {
    await loadPromise;
  }
  if (allCards.length === 0) {
    await reloadLocalScryfall(true);
  }
}

// Initial load (deferred via setImmediate to allow server startup and auth requests to complete unblocked)
setImmediate(() => {
  reloadLocalScryfall();
});

// ----------------------------------------------------
// Helper for substring match (fallback)
// ----------------------------------------------------
function substringMatch(query) {
  const q = query.toLowerCase();
  return dedupedCards.filter((c) => c.name?.toLowerCase().includes(q));
}

// ----------------------------------------------------
// Exportable Functional API
// ----------------------------------------------------

function findCardInMap(queryName) {
  if (!queryName) return null;
  const qLower = String(queryName).trim().toLowerCase();

  // 1. Exact match in nameToCardMap (contains full names, front faces, back faces)
  let card = nameToCardMap.get(qLower);
  if (card) return card;

  // 2. If queryName contains " // ", try front face
  if (qLower.includes(" // ")) {
    const front = qLower.split(" // ")[0].trim();
    card = nameToCardMap.get(front);
    if (card) return card;
  }

  // 3. Fallback: check if any deduped card starts with or matches front face
  for (const c of dedupedCards) {
    const cNameLower = (c.name || "").toLowerCase();
    if (cNameLower === qLower || cNameLower.startsWith(`${qLower} //`)) {
      return c;
    }
    if (Array.isArray(c.card_faces)) {
      for (const face of c.card_faces) {
        if (face?.name?.toLowerCase() === qLower) {
          return c;
        }
      }
    }
  }

  return null;
}

export async function getLocalCardByName(name) {
  if (!name) return null;
  await ensureLoaded();

  const card = findCardInMap(name);
  if (!card) return null;

  const oracle = card.oracle_id || card.id;
  const prints = oracleToPrintingsMap.get(oracle) || [];

  return {
    ...card,
    prints
  };
}

export async function getLocalCardsBatch(names = []) {
  await ensureLoaded();
  const result = {};

  for (const name of names) {
    if (!name) continue;
    const card = findCardInMap(name);
    if (card) {
      const oracle = card.oracle_id || card.id;
      result[name] = {
        ...card,
        prints: oracleToPrintingsMap.get(oracle) || []
      };
    }
  }

  return result;
}

export async function searchLocalCards(q) {
  if (!q) return [];
  await ensureLoaded();

  const qLower = q.trim().toLowerCase();

  // 1️⃣ Exact match first (checks full name and DFC front/back faces)
  const exactMatches = dedupedCards.filter((c) => {
    const nameLower = c.name?.toLowerCase();
    if (nameLower === qLower || nameLower?.startsWith(`${qLower} //`)) return true;
    if (Array.isArray(c.card_faces)) {
      return c.card_faces.some(f => f?.name?.toLowerCase() === qLower);
    }
    return false;
  });
  if (exactMatches.length > 0) {
    return exactMatches.slice(0, 5);
  }

  // 2️⃣ Fuzzy match
  const fuseResults = fuse ? fuse.search(q).slice(0, 20).map((r) => r.item) : [];

  // 3️⃣ Fallback substring (including card_faces)
  const substringResults = dedupedCards.filter((c) => {
    if (c.name?.toLowerCase().includes(qLower)) return true;
    if (Array.isArray(c.card_faces)) {
      return c.card_faces.some(f => f?.name?.toLowerCase().includes(qLower));
    }
    return false;
  });

  // Combine results without duplicates
  const seen = new Set();
  const combined = [...fuseResults, ...substringResults].filter((c) => {
    const id = c.oracle_id || c.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return combined.slice(0, 20);
}

// ----------------------------------------------------
// GET /api/scryfall/card?name=<exact_name>
// ----------------------------------------------------
router.get("/card", async (req, res) => {
  const name = (req.query.name || "").trim();
  if (!name) return res.status(400).json({ error: "Card name required" });

  const enhancedCard = await getLocalCardByName(name);

  if (enhancedCard) {
// console.log(` Exact card match for "${name}"`);
    return res.json(enhancedCard);
  }

// console.log(` No exact match found for "${name}"`);
  res.status(404).json({ error: "Card not found" });
});

// ----------------------------------------------------
// POST /api/scryfall/batch
// ----------------------------------------------------
router.post("/batch", async (req, res) => {
  const names = req.body.names || [];
// console.log(` [Backend /api/scryfall/batch] Received batch request for ${names.length} names:`, names);
  if (!Array.isArray(names)) return res.status(400).json({ error: "names array required" });
  
  const start = Date.now();
  const result = await getLocalCardsBatch(names);
  const matchedKeys = Object.keys(result);
// console.log(` [Backend /api/scryfall/batch] Done in ${Date.now() - start}ms. Found ${matchedKeys.length}/${names.length} cards:`, matchedKeys);
  res.json(result);
});

// ----------------------------------------------------
// GET /api/scryfall?q=<query>
// ----------------------------------------------------
router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);

  const results = await searchLocalCards(q);
  
  if (results.length > 0 && results[0].name?.toLowerCase() === q.toLowerCase()) {
// console.log(` Exact match for "${q}" → 1`);
  } else {
// console.log(` Search "${q}" → ${results.length} results`);
  }

  res.json(results);
});

export default router;
