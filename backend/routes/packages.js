// backend/routes/packages.js
import express from "express";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// 🧱 Create a new package
router.post("/", requireAuth, async (req, res) => {
  const { name, cards, is_public } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  const [pkg] = await db("packages")
    .insert({
      user_id: req.user.id,
      name,
      cards: JSON.stringify(cards || []),
      is_public: !!is_public,
    })
    .returning("*");

  res.json(pkg);
});

// GET all
router.get("/", async (req, res) => {
  try {
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
        userId = decoded.id;
      } catch {}
    }

    let packages;
    if (userId) {
      packages = await db("packages")
        .where({ user_id: userId })
        .orWhere({ is_public: true })
        .orderBy("updated_at", "desc");
    } else {
      packages = await db("packages")
        .where({ is_public: true })
        .orderBy("updated_at", "desc");
    }

    // ✅ Parse cards for every package
    const parsed = packages.map(parseCards);
    res.json(parsed);
  } catch (err) {
    console.error("❌ Error in GET /api/packages:", err);
    res.status(500).json({ error: "Failed to load packages." });
  }
});

// GET one by id
router.get("/:id", async (req, res) => {
  const pkg = await db("packages").where({ id: req.params.id }).first();
  if (!pkg) return res.status(404).json({ error: "Not found" });
  res.json(parseCards(pkg)); // ✅
});


// 🧱 Update package
router.put("/:id", requireAuth, async (req, res) => {
  const pkg = await db("packages").where({ id: req.params.id }).first();
  if (!pkg) return res.status(404).json({ error: "Not found" });
  if (pkg.user_id !== req.user.id)
    return res.status(403).json({ error: "Forbidden" });

  const { name, cards, is_public } = req.body;
  const updated = await db("packages")
    .where({ id: req.params.id })
    .update({
      name: name ?? pkg.name,
      cards: JSON.stringify(cards ?? pkg.cards),
      is_public: is_public ?? pkg.is_public,
      updated_at: db.fn.now(),
    })
    .returning("*");

  res.json(updated[0]);
});

// 🧱 Delete package
router.delete("/:id", requireAuth, async (req, res) => {
  const pkg = await db("packages").where({ id: req.params.id }).first();
  if (!pkg) return res.status(404).json({ error: "Not found" });
  if (pkg.user_id !== req.user.id)
    return res.status(403).json({ error: "Forbidden" });

  await db("packages").where({ id: req.params.id }).delete();
  res.json({ ok: true });
});

// 🔄 Import from Moxfield
router.post("/import/moxfield", requireAuth, async (req, res) => {
  console.log('[Backend] Moxfield import route called');
  console.log('[Backend] Request body:', JSON.stringify(req.body));
  console.log('[Backend] User ID:', req.user?.id);

  try {
    const { url } = req.body;
    console.log('[Backend] Received URL:', url);

    if (!url) {
      console.error('[Backend] No URL provided in request');
      return res.status(400).json({ error: "URL required" });
    }

    // Extract deck ID from Moxfield URL
    console.log('[Backend] Attempting to extract deck ID from URL');
    const deckIdMatch = url.match(/\/decks\/([a-zA-Z0-9_-]+)/);
    if (!deckIdMatch) {
      console.error('[Backend] Invalid Moxfield URL format:', url);
      return res.status(400).json({ error: "Invalid Moxfield URL" });
    }

    const deckId = deckIdMatch[1];
    console.log('[Backend] Successfully extracted deck ID:', deckId);

    // Fetch deck data from Moxfield API
    const apiUrl = `https://api.moxfield.com/v3/decks/all/${deckId}`;
    console.log('[Backend] Making API request to:', apiUrl);

    const response = await fetch(apiUrl);
    console.log('[Backend] API response status:', response.status, response.statusText);

    if (!response.ok) {
      if (response.status === 404) {
        console.error('[Backend] Deck not found (404):', deckId);
        return res.status(404).json({ error: "Deck not found or is private" });
      }
      console.error('[Backend] Moxfield API error:', response.status, response.statusText);
      throw new Error(`Moxfield API error: ${response.status}`);
    }

    const deckData = await response.json();
    console.log('[Backend] Successfully parsed JSON response');
    console.log('[Backend] Response structure:');
    console.log('[Backend] - Has boards:', !!deckData?.boards);
    console.log('[Backend] - Has sections:', !!deckData?.sections);
    console.log('[Backend] - Response has name:', !!deckData?.name);

    // Check if the response uses the new 'boards' structure or old 'sections' structure
    if (!deckData || (!deckData.boards && !deckData.sections)) {
      console.error('[Backend] Invalid deck data - missing boards or sections');
      return res.status(400).json({ error: "Invalid deck data received from Moxfield" });
    }

    // Parse cards from Moxfield format
    console.log('[Backend] Starting card parsing process');
    const cards = [];

    // Handle new 'boards' structure (boards.mainboard.cards, boards.sideboard.cards)
    if (deckData.boards) {
      console.log('[Backend] Using new boards structure');

      const mainboardCards = deckData.boards.mainboard?.cards || {};
      const sideboardCards = deckData.boards.sideboard?.cards || {};

      console.log('[Backend] Mainboard cards count:', Object.keys(mainboardCards).length);
      console.log('[Backend] Sideboard cards count:', Object.keys(sideboardCards).length);

      // Process mainboard cards
      if (Object.keys(mainboardCards).length > 0) {
        console.log('[Backend] Processing mainboard section');
        for (const [cardId, cardData] of Object.entries(mainboardCards)) {
          console.log('[Backend] Processing mainboard card:', cardId, 'data:', cardData);

          if (cardData && cardData.quantity > 0 && cardData.card) {
            const cardName = cardData.card.name;
            console.log('[Backend] Extracted card name:', cardName);

            const card = {
              name: cardName,
              quantity: cardData.quantity,
              id: cardId,
            };
            console.log('[Backend] Added mainboard card:', card);
            cards.push(card);
          } else {
            console.warn('[Backend] Skipping invalid mainboard card:', cardId, cardData);
          }
        }
      }

      // Process sideboard cards
      if (Object.keys(sideboardCards).length > 0) {
        console.log('[Backend] Processing sideboard section');
        for (const [cardId, cardData] of Object.entries(sideboardCards)) {
          console.log('[Backend] Processing sideboard card:', cardId, 'data:', cardData);

          if (cardData && cardData.quantity > 0 && cardData.card) {
            const cardName = cardData.card.name;
            console.log('[Backend] Extracted card name:', cardName);

            const card = {
              name: cardName,
              quantity: cardData.quantity,
              id: cardId,
            };
            console.log('[Backend] Added sideboard card:', card);
            cards.push(card);
          } else {
            console.warn('[Backend] Skipping invalid sideboard card:', cardId, cardData);
          }
        }
      }
    }
    // Fallback to old 'sections' structure for backward compatibility
    else if (deckData.sections) {
      console.log('[Backend] Using legacy sections structure');

      // Process mainboard cards
      if (deckData.sections.main) {
        console.log('[Backend] Processing mainboard section');
        const mainCardCount = Object.keys(deckData.sections.main).length;
        console.log('[Backend] Main section contains', mainCardCount, 'cards');

        for (const [cardName, cardData] of Object.entries(deckData.sections.main)) {
          console.log('[Backend] Processing main card:', cardName, 'data:', cardData);

          if (cardData && cardData.quantity > 0) {
            const card = {
              name: cardName,
              quantity: cardData.quantity,
              id: cardName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            };
            console.log('[Backend] Added main card:', card);
            cards.push(card);
          } else {
            console.warn('[Backend] Skipping invalid main card:', cardName, cardData);
          }
        }
      }

      // Process sideboard cards
      if (deckData.sections.sideboard) {
        console.log('[Backend] Processing sideboard section');
        const sideboardCardCount = Object.keys(deckData.sections.sideboard).length;
        console.log('[Backend] Sideboard section contains', sideboardCardCount, 'cards');

        for (const [cardName, cardData] of Object.entries(deckData.sections.sideboard)) {
          console.log('[Backend] Processing sideboard card:', cardName, 'data:', cardData);

          if (cardData && cardData.quantity > 0) {
            const card = {
              name: cardName,
              quantity: cardData.quantity,
              id: cardName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            };
            console.log('[Backend] Added sideboard card:', card);
            cards.push(card);
          } else {
            console.warn('[Backend] Skipping invalid sideboard card:', cardName, cardData);
          }
        }
      }
    }

    console.log('[Backend] Total cards parsed:', cards.length);

    if (cards.length === 0) {
      console.error('[Backend] No valid cards found in deck');
      return res.status(400).json({ error: "No cards found in the deck" });
    }

    // Enhance cards with detailed Scryfall information for printing selection
    console.log('[Backend] Enhancing cards with detailed Scryfall information');
    const enhancedCards = await enhanceCardsWithDetails(cards);
    console.log('[Backend] Enhanced cards with detailed information:', enhancedCards.length);

    // Extract deck name
    const deckName = deckData.name || `Imported Deck ${deckId.substring(0, 8)}`;
    console.log('[Backend] Using deck name:', deckName);

    const result = {
      name: deckName,
      cards: enhancedCards,
      sourceUrl: url
    };

    console.log('[Backend] Import completed successfully');
    console.log('[Backend] Final result - name:', result.name, 'cards:', result.cards.length, 'sourceUrl:', result.sourceUrl);

    res.json(result);

  } catch (error) {
    console.error('[Backend] Error importing from Moxfield:', error.message);
    console.error('[Backend] Stack trace:', error.stack);
    res.status(500).json({ error: "Failed to import from Moxfield. Please try again." });
  }
});

export default router;

// Helper function to enhance cards with detailed Scryfall information
async function enhanceCardsWithDetails(cards) {
  console.log('[Backend] enhanceCardsWithDetails called with', cards.length, 'cards');

  const enhancedCards = [];
  const uniqueCardNames = [...new Set(cards.map(card => card.name))];
  console.log('[Backend] Unique card names to fetch:', uniqueCardNames.length);

  // Import the loadCardData function
  const { loadCardData } = await import("../services/scryfallUpdater.js");
  const allCards = loadCardData();

  // Fetch detailed information for each unique card name
  for (const cardName of uniqueCardNames) {
    try {
      console.log('[Backend] Fetching details for card:', cardName);

      const nameLower = cardName.toLowerCase();

      // Find exact match in local card data
      const exactMatches = allCards.filter(
        (c) => c.name?.toLowerCase() === nameLower
      );

      if (exactMatches.length > 0) {
        console.log('[Backend] Found', exactMatches.length, 'matches for', cardName);
        const card = exactMatches[0];

        // Get all printings for this card
        const allPrintings = allCards.filter(c =>
          (c.oracle_id && c.oracle_id === card.oracle_id) ||
          (c.name?.toLowerCase() === nameLower)
        );

        // Find all instances of this card in the original cards array
        const cardInstances = cards.filter(card => card.name === cardName);

        // For each instance, create an enhanced version with detailed information
        for (const cardInstance of cardInstances) {
          const enhancedCard = {
            ...cardInstance,
            // Add detailed Scryfall information
            oracle_id: card.oracle_id,
            type_line: card.type_line,
            color_identity: card.color_identity || [],
            set: card.set,
            collector_number: card.collector_number,
            image_uris: card.image_uris,
            scryfall_uri: card.scryfall_uri,
            prices: card.prices,
            prints: allPrintings.map(p => ({
              set: p.set,
              set_name: p.set_name,
              collector_number: p.collector_number,
              prices: p.prices,
              released_at: p.released_at,
            })),
            // Choose the optimal printing (cheapest non-foil, or most recent if no price)
            selectedPrinting: selectOptimalPrinting(card, allPrintings)
          };

          enhancedCards.push(enhancedCard);
        }
      } else {
        console.warn('[Backend] No match found for', cardName);
        // If no detailed info found, keep the original card
        const cardInstances = cards.filter(card => card.name === cardName);
        enhancedCards.push(...cardInstances);
      }
    } catch (error) {
      console.error('[Backend] Error fetching details for', cardName, ':', error.message);
      // Continue with next card instead of failing completely
    }
  }

  console.log('[Backend] Enhanced', enhancedCards.length, 'card instances with details');
  return enhancedCards;
}

// Helper function to select optimal printing for a card
function selectOptimalPrinting(card, allPrintings) {
  console.log('[Backend] Selecting optimal printing for:', card.name);

  if (!allPrintings || allPrintings.length === 0) {
    console.log('[Backend] No printings available, using default');
    return {
      set: card.set,
      set_name: card.set_name,
      collector_number: card.collector_number,
      prices: card.prices,
      released_at: card.released_at
    };
  }

  // First, try to find the cheapest printing
  let cheapestPrinting = null;
  let cheapestPrice = Infinity;

  for (const printing of allPrintings) {
    const nonFoilPrice = parseFloat(printing.prices?.usd) || Infinity;
    const foilPrice = parseFloat(printing.prices?.usd_foil) || Infinity;
    const minPrice = Math.min(nonFoilPrice, foilPrice);

    if (minPrice < cheapestPrice && minPrice > 0) {
      cheapestPrice = minPrice;
      cheapestPrinting = printing;
    }
  }

  if (cheapestPrinting) {
    console.log('[Backend] Selected cheapest printing:', cheapestPrinting.set_name, '($' + cheapestPrice + ')');
    return cheapestPrinting;
  }

  // If no priced printings found, use the most recent
  const sortedPrintings = allPrintings.sort((a, b) =>
    new Date(b.released_at) - new Date(a.released_at)
  );

  console.log('[Backend] Selected most recent printing:', sortedPrintings[0].set_name);
  return sortedPrintings[0];
}


function parseCards(pkg) {
  if (!pkg) return pkg;
  try {
    return {
      ...pkg,
      cards: typeof pkg.cards === "string" ? JSON.parse(pkg.cards) : pkg.cards,
    };
  } catch {
    return { ...pkg, cards: [] };
  }
}
