/**
 * Scryfall Local Search Route
 * ---------------------------
 * Serves local search results from the cached bulk data file.
 * Uses Fuse.js for fuzzy name matching.
 * Deduplicates by oracle_id (so each unique card text appears only once).
 * 
 * ✅ Exact name match prioritized
 * ✅ Avoids Secret Lair / promo / alt-art printings
 * ✅ Only returns one canonical version per oracle_id
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
    console.log(`🧠 ScryfallLocal loaded ${allCards.length.toLocaleString()} cards from bulk data.`);

    const groups = new Map();
    nameToOracle.clear();

    for (const card of allCards) {
      const oracle = card.oracle_id || card.name?.toLowerCase() || card.id;
      if (!oracle) continue;
      if (!groups.has(oracle)) groups.set(oracle, []);
      groups.get(oracle).push(card);
      
      if (card.name) {
        nameToOracle.set(card.name.toLowerCase(), oracle);
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
          c.card_faces?.[0]?.image_uris?.normal
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
        nameToCardMap.set(card.name.toLowerCase(), card);
      }
    }

    console.log(
      `🧹 Deduplicated ${allCards.length.toLocaleString()} → ${dedupedCards.length.toLocaleString()} unique cards.`
    );

    fuse = new Fuse(dedupedCards, {
      keys: ["name"],
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

export async function getLocalCardByName(name) {
  if (!name) return null;
  await ensureLoaded();

  const nameLower = name.toLowerCase();
  const card = nameToCardMap.get(nameLower);
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
    const cardData = await getLocalCardByName(name);
    if (cardData) {
      result[name] = cardData;
    }
  }

  return result;
}

export async function searchLocalCards(q) {
  if (!q) return [];
  await ensureLoaded();

  const qLower = q.toLowerCase();

  // 1️⃣ Exact match first
  const exactMatches = dedupedCards.filter(
    (c) => c.name?.toLowerCase() === qLower
  );
  if (exactMatches.length > 0) {
    return exactMatches.slice(0, 1);
  }

  // 2️⃣ Fuzzy match
  const fuseResults = fuse ? fuse.search(q).slice(0, 20).map((r) => r.item) : [];

  // 3️⃣ Fallback substring
  const substringResults = substringMatch(q);

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
    console.log(`✅ Exact card match for "${name}"`);
    return res.json(enhancedCard);
  }

  console.log(`❌ No exact match found for "${name}"`);
  res.status(404).json({ error: "Card not found" });
});

// ----------------------------------------------------
// POST /api/scryfall/batch
// ----------------------------------------------------
router.post("/batch", async (req, res) => {
  const names = req.body.names || [];
  console.log(`📦 [Backend /api/scryfall/batch] Received batch request for ${names.length} names:`, names);
  if (!Array.isArray(names)) return res.status(400).json({ error: "names array required" });
  
  const start = Date.now();
  const result = await getLocalCardsBatch(names);
  const matchedKeys = Object.keys(result);
  console.log(`✅ [Backend /api/scryfall/batch] Done in ${Date.now() - start}ms. Found ${matchedKeys.length}/${names.length} cards:`, matchedKeys);
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
     console.log(`✅ Exact match for "${q}" → 1`);
  } else {
     console.log(`🔎 Search "${q}" → ${results.length} results`);
  }

  res.json(results);
});

export default router;
