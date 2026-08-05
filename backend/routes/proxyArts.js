import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { XMLParser } from "fast-xml-parser";
import { getLocalCardsBatch } from "./scryfallLocal.js";
import { isDoubleFacedCard } from "../utils/cardHelpers.js";

const router = express.Router();
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_"
});

// GET /api/user/proxy-arts
router.get("/", requireAuth, async (req, res) => {
  try {
    const arts = await db("user_proxy_arts")
      .where({ user_id: req.user.id });
    res.json(arts);
  } catch (err) {
    console.error("Error fetching proxy arts:", err);
    res.status(500).json({ error: "Failed to fetch proxy arts." });
  }
});

// POST /api/user/proxy-arts/import
router.post("/import", requireAuth, async (req, res) => {
  const { xml } = req.body;
  if (!xml) return res.status(400).json({ error: "Missing xml field." });

  try {
    const jsonObj = parser.parse(xml);
    const fronts = jsonObj?.order?.fronts?.card;
    const backs = jsonObj?.order?.backs?.card;
    
    if (!fronts) {
      return res.status(400).json({ error: "Invalid MPCFill XML format. Missing <fronts><card>." });
    }

    // fast-xml-parser returns a single object if there's only one <card>, otherwise an array
    const frontCards = Array.isArray(fronts) ? fronts : [fronts];
    const backCards = backs ? (Array.isArray(backs) ? backs : [backs]) : [];
    const cards = [...frontCards, ...backCards];
    
    // Fetch user's existing cards to build a canonical name map
    const userCards = await db("user_cards")
      .where({ user_id: req.user.id })
      .distinct("card_name");

    const normalizeName = (name) => (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const stripStopWords = (name) => (name || "").toLowerCase().replace(/\b(the|of|a|an|and)\b/g, "").replace(/[^a-z0-9]/g, "");
    
    // Fetch Scryfall metadata to determine true double-faced cards
    const uniqueNames = Array.from(new Set(userCards.map(c => c.card_name)));
    const scryfallData = await getLocalCardsBatch(uniqueNames);

    const canonicalNameMap = new Map();
    const strippedNameMap = new Map();
    for (const row of userCards) {
      const meta = scryfallData[row.card_name];
      const isDfc = isDoubleFacedCard(meta);

      if (isDfc && row.card_name.includes(" // ")) {
        // Split true DFCs so both front and back can be canonical targets
        const faces = row.card_name.split(" // ");
        for (const face of faces) {
          canonicalNameMap.set(normalizeName(face), face);
          strippedNameMap.set(stripStopWords(face), face);
        }
      } else {
        // Single-faced cards (including split cards like "Wear // Tear")
        canonicalNameMap.set(normalizeName(row.card_name), row.card_name);
        strippedNameMap.set(stripStopWords(row.card_name), row.card_name);
      }
    }
    
    console.log("[proxyArts Import] Canonical Name Map built with", canonicalNameMap.size, "unique items");

    let importedCount = 0;
    
    for (const card of cards) {
      if (!card.query || !card.id || !card.name) continue;
      
      const normalizedQuery = normalizeName(card.query);
      const strippedQuery = stripStopWords(card.query);
      let cardName = card.query;
      
      console.log(`[proxyArts Import] Processing card from XML. Query: "${card.query}", Normalized: "${normalizedQuery}", Stripped: "${strippedQuery}"`);
      
      // Attempt to map back to the exact punctuation/casing in Manabase
      if (canonicalNameMap.has(normalizedQuery)) {
        cardName = canonicalNameMap.get(normalizedQuery);
        console.log(`  -> Match found! Mapping to Canonical: "${cardName}"`);
      } else if (strippedNameMap.has(strippedQuery)) {
        cardName = strippedNameMap.get(strippedQuery);
        console.log(`  -> Stop-Word Match found! Mapping to Canonical: "${cardName}"`);
      } else {
        // Fallback: Check if one stripped name is a substring of the other
        let substringMatch = null;
        for (const [key, val] of strippedNameMap.entries()) {
          if (key.includes(strippedQuery) || strippedQuery.includes(key)) {
            substringMatch = val;
            break;
          }
        }
        if (substringMatch) {
          cardName = substringMatch;
          console.log(`  -> Substring Match found! Mapping to Canonical: "${cardName}"`);
        } else {
          console.log(`  -> No canonical match found! Falling back to raw query: "${cardName}"`);
        }
      }
      
      await db("user_proxy_arts")
        .insert({
          user_id: req.user.id,
          card_name: cardName,
          mpcfill_id: String(card.id),
          mpcfill_name: String(card.name),
          mpcfill_query: String(card.query)
        })
        .onConflict(["user_id", "card_name"])
        .merge(["mpcfill_id", "mpcfill_name", "mpcfill_query", "updated_at"]);
        
      importedCount++;
    }

    res.json({ success: true, count: importedCount });
  } catch (err) {
    console.error("Error parsing MPCFill XML:", err);
    res.status(500).json({ error: "Failed to process MPCFill XML." });
  }
});

// DELETE /api/user/proxy-arts/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await db("user_proxy_arts")
      .where({ id: req.params.id, user_id: req.user.id })
      .del();
      
    if (!deleted) {
      return res.status(404).json({ error: "Proxy art not found." });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting proxy art:", err);
    res.status(500).json({ error: "Failed to delete proxy art." });
  }
});

export default router;
