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
const allCards = loadCardData();
console.log(`🧠 ScryfallLocal loaded ${allCards.length.toLocaleString()} cards from bulk data.`);

// ----------------------------------------------------
// Deduplicate by oracle_id (keep best printing per card)
// ----------------------------------------------------
const groups = new Map();

for (const card of allCards) {
  const oracle = card.oracle_id || card.name?.toLowerCase() || card.id;
  if (!oracle) continue;
  if (!groups.has(oracle)) groups.set(oracle, []);
  groups.get(oracle).push(card);
}

const dedupedCards = [];

for (const [oracle, cards] of groups.entries()) {
  // Skip tokens, art-only, and placeholder layouts
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

  // --- Sorting preference ---
  filtered.sort((a, b) => {
    const dateA = a.released_at ? new Date(a.released_at) : new Date(0);
    const dateB = b.released_at ? new Date(b.released_at) : new Date(0);

    // 1️⃣ Prefer newer printings overall
    if (dateB - dateA !== 0) return dateB - dateA;

    // 2️⃣ Strongly prefer non-Secret-Lair versions
    const isSecretLairA = a.set?.toLowerCase() === "sld" || a.set_name?.toLowerCase().includes("secret lair");
    const isSecretLairB = b.set?.toLowerCase() === "sld" || b.set_name?.toLowerCase().includes("secret lair");
    if (isSecretLairA !== isSecretLairB) return isSecretLairA ? 1 : -1;

    // 3️⃣ Prefer normal border, non-promo, non-full-art
    const promoA = a.promo || a.full_art || a.border_color === "borderless";
    const promoB = b.promo || b.full_art || b.border_color === "borderless";
    if (promoA !== promoB) return promoA ? 1 : -1;

    // 4️⃣ Fallback to collector number
    const numA = parseInt(a.collector_number) || 0;
    const numB = parseInt(b.collector_number) || 0;
    return numB - numA;
  });

  dedupedCards.push(filtered[0]);
}

console.log(
  `🧹 Deduplicated ${allCards.length.toLocaleString()} → ${dedupedCards.length.toLocaleString()} unique cards (Secret Lairs deprioritized).`
);

// ----------------------------------------------------
// Fuse.js setup (for fuzzy name matching)
// ----------------------------------------------------
const fuse = new Fuse(dedupedCards, {
  keys: ["name"],
  threshold: 0.2, // stricter = fewer wrong matches
  ignoreLocation: true,
  minMatchCharLength: 3,
});

// ----------------------------------------------------
// Helper for substring match (fallback)
// ----------------------------------------------------
function substringMatch(query) {
  const q = query.toLowerCase();
  return dedupedCards.filter((c) => c.name?.toLowerCase().includes(q));
}

// ----------------------------------------------------
// GET /api/scryfall/card?name=<exact_name>
// ----------------------------------------------------
router.get("/card", (req, res) => {
  const name = (req.query.name || "").trim();
  if (!name) return res.status(400).json({ error: "Card name required" });

  const nameLower = name.toLowerCase();

  // Find exact match
  const exactMatches = dedupedCards.filter(
    (c) => c.name?.toLowerCase() === nameLower
  );

  if (exactMatches.length > 0) {
    console.log(`✅ Exact card match for "${name}"`);
    const card = exactMatches[0];

    // Enhance with all printings information
    const allPrintings = allCards.filter(c =>
      (c.oracle_id && c.oracle_id === card.oracle_id) ||
      (c.name?.toLowerCase() === nameLower)
    );

    const enhancedCard = {
      ...card,
      prints: allPrintings.map(p => ({
        set: p.set,
        set_name: p.set_name,
        collector_number: p.collector_number,
        prices: p.prices,
        released_at: p.released_at,
      }))
    };

    return res.json(enhancedCard);
  }

  console.log(`❌ No exact match found for "${name}"`);
  res.status(404).json({ error: "Card not found" });
});

// ----------------------------------------------------
// GET /api/scryfall?q=<query>
// ----------------------------------------------------
router.get("/", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);

  const qLower = q.toLowerCase();

  // 1️⃣ Exact match first
  const exactMatches = dedupedCards.filter(
    (c) => c.name?.toLowerCase() === qLower
  );
  if (exactMatches.length > 0) {
    console.log(`✅ Exact match for "${q}" → ${exactMatches.length}`);
    return res.json(exactMatches.slice(0, 1));
  }

  // 2️⃣ Fuzzy match
  const fuseResults = fuse.search(q).slice(0, 20).map((r) => r.item);

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

  console.log(`🔎 Search "${q}" → ${combined.length} results`);
  res.json(combined.slice(0, 20));
});

export default router;
