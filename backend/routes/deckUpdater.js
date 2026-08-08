import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { getStrictlyBetterUpgrades, getEDHRecSuggestions, syncStrictlyBetterData } from "../services/deckUpdater.js";
import { getLocalCardsBatch } from "./scryfallLocal.js";
import { fetchMoxfieldDeck } from "../services/moxfieldSync.js";
import axios from "axios";

const router = express.Router();

// GET /api/deck-updater/decks
// Get a list of the user's cached decks with commanders
router.get("/decks", requireAuth, async (req, res) => {
  try {
    const decks = await db("user_archidekt_decks")
      .where({ user_id: req.user.id })
      .orderBy("updated_at", "desc");
    res.json(decks);
  } catch (error) {
    console.error("Failed to fetch updater decks:", error.message);
    res.status(500).json({ error: "Failed to fetch decks" });
  }
});

// GET /api/deck-updater/analyze-all
// Analyzes all user decks using DB cached items and returns a summary
router.get("/analyze-all", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const decks = await db("user_archidekt_decks")
      .where({ user_id: userId })
      .orderBy("updated_at", "desc");

    // Fetch user dismissals
    const userDismissals = await db("user_deck_dismissals")
      .where({ user_id: userId });
      
    const dismissalsSet = new Set(
      userDismissals.map(d => `${d.deck_id}::${d.suggestion_id}`)
    );

    const results = [];
    const allUniqueCardNames = new Set();

    for (const deck of decks) {
      let deckCardNames = [];
      let commanderName = deck.commander;
      
      // If the deck is missing the 'cards' JSON array (e.g. older sync), fetch directly to heal it
      if (!deck.cards) {
        try {
          if (deck.source === "moxfield") {
            const moxfieldData = await fetchMoxfieldDeck(deck.deck_id);
            deckCardNames = moxfieldData.cards.map(c => c.cardName);
            if (!commanderName) commanderName = moxfieldData.commander;
          } else {
            const archidektRes = await axios.get(`https://archidekt.com/api/decks/${deck.deck_id}/`);
            const archidektDeck = archidektRes.data;
            if (archidektDeck.cards) {
              deckCardNames = archidektDeck.cards
                .filter(item => item.card && item.card.oracleCard)
                .map(item => item.card.oracleCard.name);
              
              if (!commanderName) {
                for (const item of archidektDeck.cards) {
                  if (item.categories && item.categories.includes("Commander") && item.card && item.card.oracleCard) {
                    commanderName = item.card.oracleCard.name;
                    break;
                  }
                }
              }
            }
          }

          // Heal the DB cache
          await db("user_archidekt_decks")
            .where({ id: deck.id })
            .update({
              cards: JSON.stringify(deckCardNames),
              commander: commanderName
            });
        } catch (e) {
          console.warn(`Could not heal missing cache for deck ${deck.deck_id}`);
          // Fallback to deck items just in case
          const items = await db("user_archidekt_deck_items").where({ user_id: userId, deck_id: deck.deck_id });
          deckCardNames = items.map(i => i.card_name);
        }
      } else {
        deckCardNames = typeof deck.cards === 'string' ? JSON.parse(deck.cards) : deck.cards;
      }

      const strictlyBetterRaw = getStrictlyBetterUpgrades(deckCardNames);
      const edhrecRaw = await getEDHRecSuggestions(commanderName, deckCardNames);

      // Filter out dismissals
      const strictlyBetter = strictlyBetterRaw.filter(u => {
        const id = `strictly_better:${u.currentCard}`;
        return !dismissalsSet.has(`${deck.deck_id}::${id}`);
      });
      
      const newCards = (edhrecRaw.newCards || []).filter(c => {
        const id = `edhrec_new:${c.name}`;
        return !dismissalsSet.has(`${deck.deck_id}::${id}`);
      });
      
      const highSynergy = (edhrecRaw.highSynergy || []).filter(c => {
        const id = `edhrec_synergy:${c.name}`;
        return !dismissalsSet.has(`${deck.deck_id}::${id}`);
      });

      // Collect unique names for Scryfall
      for (const u of strictlyBetter) {
        allUniqueCardNames.add(u.currentCard);
        u.strictlyBetterCards.forEach(s => allUniqueCardNames.add(s));
      }
      for (const c of newCards) allUniqueCardNames.add(c.name);
      for (const c of highSynergy) allUniqueCardNames.add(c.name);
      if (commanderName) allUniqueCardNames.add(commanderName);

      results.push({
        deck_id: deck.deck_id,
        deck_name: deck.deck_name,
        commander: commanderName,
        strictlyBetter,
        edhrec: {
          newCards,
          highSynergy
        }
      });
    }

    // Enrich with Scryfall local data
    const scryfallData = await getLocalCardsBatch(Array.from(allUniqueCardNames));
    
    const enrichCardObj = (name) => {
      const sf = scryfallData[name];
      if (!sf) return { name, image_uri: null, price: null };
      const image_uri = sf.image_uris?.normal || sf.card_faces?.[0]?.image_uris?.normal || null;
      const price = sf.prices?.usd || sf.prices?.usd_foil || null;
      return { name, image_uri, price };
    };

    // Inject data into results
    for (const res of results) {
      if (res.commander) {
        res.commanderData = enrichCardObj(res.commander);
      }
      
      res.strictlyBetter = res.strictlyBetter.map(sb => ({
        ...sb,
        currentCardData: enrichCardObj(sb.currentCard),
        strictlyBetterCardsData: sb.strictlyBetterCards.map(c => enrichCardObj(c))
      }));
      
      res.edhrec.newCards = res.edhrec.newCards.map(c => ({
        ...c,
        ...enrichCardObj(c.name)
      }));
      
      res.edhrec.highSynergy = res.edhrec.highSynergy.map(c => ({
        ...c,
        ...enrichCardObj(c.name)
      }));
    }

    res.json(results);
  } catch (error) {
    console.error("Failed to analyze all decks:", error.message);
    res.status(500).json({ error: "Failed to analyze all decks" });
  }
});

// GET /api/deck-updater/:deckId
// Returns strictly better upgrades and EDHRec suggestions for the deck
router.get("/:deckId", requireAuth, async (req, res) => {
  try {
    const { deckId } = req.params;
    const userId = req.user.id;

    // Fetch the deck to ensure it belongs to the user and get commander
    const deck = await db("user_archidekt_decks")
      .where({ user_id: userId, deck_id: String(deckId) })
      .first();

    if (!deck) {
      return res.status(404).json({ error: "Deck not found" });
    }

    // Instead of querying user_cards (which is filtered by sync mappings),
    // we should ideally query Archidekt again, OR use the `user_archidekt_deck_items` if it contains ALL cards.
    // However, `user_archidekt_deck_items` only tracks mapped cards. 
    // To be perfectly accurate for the whole deck, we will re-fetch from Archidekt here just for analysis.
    // (We cache the commander in the DB, but pulling the live deck is best for fresh analysis)
    let deckCardNames = [];
    let commanderName = deck.commander;

    try {
      if (deck.source === "moxfield") {
        const moxfieldData = await fetchMoxfieldDeck(deckId);
        deckCardNames = moxfieldData.cards.map(c => c.cardName);
        if (!commanderName) commanderName = moxfieldData.commander;
      } else {
        const archidektRes = await axios.get(`https://archidekt.com/api/decks/${deckId}/`);
        const archidektDeck = archidektRes.data;
        
        if (archidektDeck.cards) {
          deckCardNames = archidektDeck.cards
            .filter(item => item.card && item.card.oracleCard)
            .map(item => item.card.oracleCard.name);
            
          // Re-check commander if it was missing in DB
          if (!commanderName) {
            for (const item of archidektDeck.cards) {
              if (item.categories && item.categories.includes("Commander") && item.card && item.card.oracleCard) {
                commanderName = item.card.oracleCard.name;
                break;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Could not fetch live deck ${deckId} (${deck.source || "archidekt"}), falling back to DB items.`);
      // Fallback to db
      const items = await db("user_archidekt_deck_items").where({ user_id: userId, deck_id: String(deckId) });
      deckCardNames = items.map(i => i.card_name);
    }

    // Process upgrades
    const strictlyBetter = getStrictlyBetterUpgrades(deckCardNames);
    const edhrec = await getEDHRecSuggestions(commanderName, deckCardNames);

    res.json({
      commander: commanderName,
      strictlyBetter,
      edhrec
    });

  } catch (error) {
    console.error("Deck Updater analysis error:", error.message);
    res.status(500).json({ error: "Failed to analyze deck" });
  }
});

// POST /api/deck-updater/sync
// Admin/Background route to trigger a re-download of strictly better data
router.post("/sync", async (req, res) => {
  // Usually this would be protected by an admin token, but for now we'll just trigger it
  syncStrictlyBetterData();
  res.json({ message: "Strictly better sync started in background." });
});

// POST /api/deck-updater/dismiss
// Dismisses a suggestion for a deck
router.post("/dismiss", requireAuth, async (req, res) => {
  try {
    const { deck_id, suggestion_id } = req.body;
    await db("user_deck_dismissals").insert({
      user_id: req.user.id,
      deck_id: String(deck_id),
      suggestion_id: String(suggestion_id)
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to dismiss:", error.message);
    res.status(500).json({ error: "Failed to dismiss" });
  }
});

// POST /api/deck-updater/undismiss
// Undismisses a suggestion for a deck
router.post("/undismiss", requireAuth, async (req, res) => {
  try {
    const { deck_id, suggestion_id } = req.body;
    console.log(`[DeckUpdater] Attempting to undismiss deck_id: ${deck_id} (${typeof deck_id}), suggestion_id: ${suggestion_id}`);
    
    const count = await db("user_deck_dismissals")
      .where({
        user_id: req.user.id,
        deck_id: String(deck_id),
        suggestion_id: String(suggestion_id)
      })
      .delete();
      
    // If it failed to delete by string, try by integer just in case it was stored that way
    if (count === 0 && !isNaN(Number(deck_id))) {
      await db("user_deck_dismissals")
        .where({
          user_id: req.user.id,
          deck_id: Number(deck_id),
          suggestion_id: String(suggestion_id)
        })
        .delete();
    }
      
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to undismiss:", error.message);
    res.status(500).json({ error: "Failed to undismiss" });
  }
});

// GET /api/deck-updater/dismissals
// Gets all dismissals for the user
router.get("/dismissals", requireAuth, async (req, res) => {
  try {
    const dismissals = await db("user_deck_dismissals")
      .where({ user_id: req.user.id })
      .orderBy("created_at", "desc");
    res.json(dismissals);
  } catch (error) {
    console.error("Failed to fetch dismissals:", error.message);
    res.status(500).json({ error: "Failed to fetch dismissals" });
  }
});

export default router;
