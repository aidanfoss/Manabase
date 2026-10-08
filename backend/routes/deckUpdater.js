import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { getStrictlyBetterUpgrades, getEDHRecSuggestions, syncStrictlyBetterData } from "../services/deckUpdater.js";
import { getLocalCardsBatch } from "./scryfallLocal.js";
import { fetchMoxfieldDeck } from "../services/moxfieldSync.js";
import axios from "axios";
import { analyzeLands } from "../services/landAnalyzer.js";

const router = express.Router();

const DEFAULT_LAND_PREFERENCES = {
  budgetTier: "all",
  maxPricePerLand: null,
  excludeReservedList: true,
  excludeTapped: true,
  likedCycles: [],
  dislikedCycles: []
};

async function getUserLandPreferences(userId) {
  try {
    const row = await db("user_land_preferences").where({ user_id: userId }).first();
    if (row && row.preferences) {
      const parsed = typeof row.preferences === "string" ? JSON.parse(row.preferences) : row.preferences;
      return { ...DEFAULT_LAND_PREFERENCES, ...parsed };
    }
  } catch (e) {
    console.warn("Could not fetch user land preferences:", e.message);
  }
  return { ...DEFAULT_LAND_PREFERENCES };
}

// GET /api/deck-updater/land-preferences
router.get("/land-preferences", requireAuth, async (req, res) => {
  try {
    const preferences = await getUserLandPreferences(req.user.id);
    res.json({ preferences });
  } catch (error) {
    console.error("Failed to fetch land preferences:", error.message);
    res.status(500).json({ error: "Failed to fetch land preferences" });
  }
});

// PUT & POST /api/deck-updater/land-preferences
const saveLandPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const rawPreferences = req.body?.preferences || req.body || {};
    const preferences = {
      ...DEFAULT_LAND_PREFERENCES,
      ...rawPreferences
    };

    const existing = await db("user_land_preferences").where({ user_id: userId }).first();
    if (existing) {
      await db("user_land_preferences")
        .where({ user_id: userId })
        .update({
          preferences: JSON.stringify(preferences),
          updated_at: new Date()
        });
    } else {
      await db("user_land_preferences").insert({
        user_id: userId,
        preferences: JSON.stringify(preferences)
      });
    }

    res.json({ success: true, preferences });
  } catch (error) {
    console.error("Failed to save land preferences:", error.message);
    res.status(500).json({ error: "Failed to save land preferences" });
  }
};

router.put("/land-preferences", requireAuth, saveLandPreferences);
router.post("/land-preferences", requireAuth, saveLandPreferences);

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

async function runAnalyzeAll(req, res, customPreferences = null) {
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

    // Resolve land preferences
    const dbPreferences = await getUserLandPreferences(userId);
    let resolvedLandPreferences = { ...dbPreferences };

    if (customPreferences && typeof customPreferences === "object") {
      resolvedLandPreferences = { ...resolvedLandPreferences, ...customPreferences };
    } else if (req.query.preferences) {
      try {
        const queryPrefs = JSON.parse(req.query.preferences);
        resolvedLandPreferences = { ...resolvedLandPreferences, ...queryPrefs };
      } catch (e) {
        // ignore JSON parse errors from query params
      }
    }

    if (req.query.budgetTier) {
      resolvedLandPreferences.budgetTier = req.query.budgetTier;
    }
    if (req.query.maxPricePerLand !== undefined) {
      resolvedLandPreferences.maxPricePerLand = req.query.maxPricePerLand;
    }

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

      const landAnalysis = analyzeLands(commanderName, deckCardNames, resolvedLandPreferences);
      const landUpgrades = {
        cuts: landAnalysis.cuts.filter(c => !dismissalsSet.has(`${deck.deck_id}::land_cut:${c.name}`)),
        adds: landAnalysis.adds.filter(a => !dismissalsSet.has(`${deck.deck_id}::land_add:${a.name}`)),
        colorIdentity: landAnalysis.colorIdentity,
        preferencesApplied: landAnalysis.preferencesApplied
      };

      for (const cut of landUpgrades.cuts) allUniqueCardNames.add(cut.name);
      for (const add of landUpgrades.adds) allUniqueCardNames.add(add.name);

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
        },
        landUpgrades
      });
    }

    // Enrich with Scryfall local data
    const scryfallData = await getLocalCardsBatch(Array.from(allUniqueCardNames));

    const enrichCardObj = (name) => {
      const sf = scryfallData[name];
      if (!sf) return { name, image_uri: null, price: null, set_type: null, set: null };

      const image_uri = sf.image_uris?.normal || sf.card_faces?.[0]?.image_uris?.normal || null;
      const price = sf.prices?.usd || sf.prices?.usd_foil || null;
      const set_type = sf.set_type || null;
      const set = sf.set || null;

      return { name, image_uri, price, set_type, set };
    };

    // Inject data into results
    for (const res of results) {
      if (res.commander) {
        res.commanderData = enrichCardObj(res.commander);
      }

      const isDigitalOnly = (card) => {
        return card.set_type === 'alchemy' || card.set === 'a25' || card.set === 'a26';
      };

      res.strictlyBetter = res.strictlyBetter
        .map(sb => ({
          ...sb,
          currentCardData: enrichCardObj(sb.currentCard),
          strictlyBetterCardsData: sb.strictlyBetterCards.map(c => enrichCardObj(c))
        }))
        .filter(sb => !isDigitalOnly(sb.currentCardData) && !sb.strictlyBetterCardsData.some(isDigitalOnly));

      res.edhrec.newCards = res.edhrec.newCards
        .map(c => ({
          ...c,
          ...enrichCardObj(c.name)
        }))
        .filter(c => !isDigitalOnly(c));

      res.edhrec.highSynergy = res.edhrec.highSynergy
        .map(c => ({
          ...c,
          ...enrichCardObj(c.name)
        }))
        .filter(c => !isDigitalOnly(c));

      res.landUpgrades = {
        ...res.landUpgrades,
        cuts: res.landUpgrades.cuts.map(c => ({ ...c, ...enrichCardObj(c.name) })),
        adds: res.landUpgrades.adds.map(a => ({ ...a, ...enrichCardObj(a.name) }))
      };
    }

    res.json(results);
  } catch (error) {
    console.error("Failed to analyze all decks:", error.message);
    res.status(500).json({ error: "Failed to analyze all decks" });
  }
}

// GET /api/deck-updater/analyze-all
router.get("/analyze-all", requireAuth, (req, res) => runAnalyzeAll(req, res));

// POST /api/deck-updater/analyze-all
router.post("/analyze-all", requireAuth, (req, res) => runAnalyzeAll(req, res, req.body?.preferences || req.body));

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

// POST /api/deck-updater/sync
router.post("/sync", async (req, res) => {
  syncStrictlyBetterData();
  res.json({ message: "Strictly better sync started in background." });
});

// POST /api/deck-updater/dismiss
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
router.post("/undismiss", requireAuth, async (req, res) => {
  try {
    const { deck_id, suggestion_id } = req.body;

    const count = await db("user_deck_dismissals")
      .where({
        user_id: req.user.id,
        deck_id: String(deck_id),
        suggestion_id: String(suggestion_id)
      })
      .delete();

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

// GET /api/deck-updater/analyze-lands
router.get("/analyze-lands", requireAuth, async (req, res) => {
  try {
    const { deckId } = req.query;
    const userId = req.user.id;

    if (!deckId) return res.status(400).json({ error: "Missing deckId" });

    const deck = await db("user_archidekt_decks")
      .where({ user_id: userId, deck_id: String(deckId) })
      .first();

    if (!deck) {
      return res.status(404).json({ error: "Deck not found" });
    }

    let deckCardNames = [];
    let commanderName = deck.commander;

    if (deck.cards) {
       deckCardNames = typeof deck.cards === 'string' ? JSON.parse(deck.cards) : deck.cards;
    } else {
       const items = await db("user_archidekt_deck_items").where({ user_id: userId, deck_id: String(deckId) });
       deckCardNames = items.map(i => i.card_name);
    }

    const userDismissals = await db("user_deck_dismissals").where({ user_id: userId, deck_id: String(deckId) });
    const dismissalsSet = new Set(userDismissals.map(d => d.suggestion_id));

    const preferences = await getUserLandPreferences(userId);
    const analysis = analyzeLands(commanderName, deckCardNames, preferences);

    analysis.cuts = analysis.cuts.filter(c => !dismissalsSet.has(`land_cut:${c.name}`));
    analysis.adds = analysis.adds.filter(a => !dismissalsSet.has(`land_add:${a.name}`));

    res.json(analysis);

  } catch (error) {
    console.error("Land analysis error:", error);
    res.status(500).json({ error: "Failed to analyze lands" });
  }
});

// GET /api/deck-updater/:deckId
// Returns strictly better upgrades and EDHRec suggestions for the deck
router.get("/:deckId", requireAuth, async (req, res) => {
  try {
    const { deckId } = req.params;
    const userId = req.user.id;

    const deck = await db("user_archidekt_decks")
      .where({ user_id: userId, deck_id: String(deckId) })
      .first();

    if (!deck) {
      return res.status(404).json({ error: "Deck not found" });
    }

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
      const items = await db("user_archidekt_deck_items").where({ user_id: userId, deck_id: String(deckId) });
      deckCardNames = items.map(i => i.card_name);
    }

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

export default router;
