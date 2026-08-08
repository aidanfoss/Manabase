import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { fetchMoxfieldDeck, syncMoxfieldDeckInternal, parseMoxfieldDeckId } from "../services/moxfieldSync.js";

const router = express.Router();

// PUT /api/moxfield/config
// Updates the user's Moxfield tag mappings
router.put("/config", requireAuth, async (req, res) => {
  const { tag_mappings } = req.body;

  try {
    await db("users")
      .where({ id: req.user.id })
      .update({
        moxfield_tag_mappings: typeof tag_mappings === 'object' ? JSON.stringify(tag_mappings) : tag_mappings
      });

    res.json({ message: "Moxfield config updated successfully" });
  } catch (err) {
    console.error("Failed to update Moxfield config:", err);
    res.status(500).json({ error: "Failed to update config" });
  }
});

// GET /api/moxfield/deck/:id
// Proxy to fetch Moxfield deck metadata (to show user preview & tags)
router.get("/deck/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const deck = await fetchMoxfieldDeck(id);
    res.json(deck);
  } catch (err) {
    console.error("Failed to fetch Moxfield deck:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch deck from Moxfield" });
  }
});

// POST /api/moxfield/sync/:id
// Syncs a specific Moxfield deck based on tag mappings
router.post("/sync/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { mappings } = req.body;

  try {
    if (mappings !== undefined) {
      await db("users")
        .where({ id: req.user.id })
        .update({
          moxfield_tag_mappings: typeof mappings === 'object' ? JSON.stringify(mappings) : mappings
        });
    }

    const result = await syncMoxfieldDeckInternal(id, req.user.id, mappings);
    res.json({ message: "Sync successful", stats: result.stats });
  } catch (err) {
    console.error("Failed to sync Moxfield deck:", err.message);
    res.status(500).json({ error: err.message || "Failed to sync deck from Moxfield" });
  }
});

// GET /api/moxfield/decks
// Get all saved Moxfield decks for the user
router.get("/decks", requireAuth, async (req, res) => {
  try {
    const decks = await db("user_archidekt_decks")
      .where({ user_id: req.user.id, source: "moxfield" })
      .orderBy("updated_at", "desc");
    res.json(decks);
  } catch (error) {
    console.error("Moxfield fetch decks error:", error.message);
    res.status(500).json({ error: "Failed to fetch saved decks" });
  }
});

// PUT /api/moxfield/decks/:deckId
// Update deck options without syncing cards
router.put("/decks/:deckId", requireAuth, async (req, res) => {
  try {
    const { is_public, status } = req.body;
    const cleanId = parseMoxfieldDeckId(req.params.deckId);

    await db("user_archidekt_decks")
      .where({ user_id: req.user.id, deck_id: cleanId, source: "moxfield" })
      .update({
        is_public: is_public,
        status: status,
        updated_at: db.fn.now()
      });
    res.json({ message: "Deck options updated" });
  } catch (error) {
    console.error("Moxfield update deck error:", error.message);
    res.status(500).json({ error: "Failed to update deck options" });
  }
});

// POST /api/moxfield/refresh-lists
// Clears tradelist/wishlist entries from Moxfield decks, then resyncs active decks.
router.post("/refresh-lists", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const activeDecks = await db("user_archidekt_decks")
      .where({ user_id: userId, source: "moxfield" })
      .whereNot({ status: "archived" });

    if (activeDecks.length === 0) {
      return res.json({
        message: "No active Moxfield decks found to refresh.",
        stats: { decks: 0, added: 0, removed: 0 }
      });
    }

    const deckItems = await db("user_archidekt_deck_items")
      .where({ user_id: userId, source: "moxfield" })
      .whereIn("list_type", ["tradelist", "wishlist"]);

    await db.transaction(async (trx) => {
      for (const item of deckItems) {
        const isFoil = item.is_foil === true || item.is_foil === 1;
        const existing = await trx("user_cards")
          .where({
            user_id: userId,
            card_name: item.card_name,
            list_type: item.list_type,
            set_code: item.set_code,
            is_foil: isFoil,
            card_condition: "NM",
            card_language: "EN"
          })
          .first();

        if (existing) {
          const newTotal = existing.quantity - item.quantity;
          if (newTotal <= 0) {
            await trx("user_cards").where({ id: existing.id }).delete();
          } else {
            await trx("user_cards")
              .where({ id: existing.id })
              .update({ quantity: newTotal, updated_at: trx.fn.now() });
          }
        }
      }

      await trx("user_archidekt_deck_items")
        .where({ user_id: userId, source: "moxfield" })
        .whereIn("list_type", ["tradelist", "wishlist"])
        .delete();
    });

    let totalStats = { added: 0, removed: 0, ignored: 0 };
    const errors = [];

    for (const deck of activeDecks) {
      try {
        const result = await syncMoxfieldDeckInternal(deck.deck_id, userId);
        if (result.stats) {
          totalStats.added += result.stats.added || 0;
          totalStats.removed += result.stats.removed || 0;
          totalStats.ignored += result.stats.ignored || 0;
        }
      } catch (err) {
        console.error(`Failed to resync Moxfield deck ${deck.deck_id} during refresh:`, err.message);
        errors.push({ deckId: deck.deck_id, error: err.message });
      }
    }

    const response = {
      message: `Refreshed ${activeDecks.length} Moxfield deck(s).`,
      stats: {
        decks: activeDecks.length,
        ...totalStats
      }
    };

    if (errors.length > 0) {
      response.warnings = errors;
    }

    res.json(response);
  } catch (err) {
    console.error("Failed to refresh Moxfield lists:", err.message);
    res.status(500).json({ error: "Failed to refresh Moxfield lists" });
  }
});

export default router;
