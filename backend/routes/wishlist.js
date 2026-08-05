import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/collection/wishlist
router.get("/", requireAuth, async (req, res) => {
  try {
    const cards = await db("user_cards")
      .where({ "user_cards.user_id": req.user.id, "user_cards.list_type": "wishlist" })
      .select("user_cards.*")
      .orderBy("user_cards.card_name", "asc");

    const proxyArts = await db("user_proxy_arts").where("user_id", req.user.id);
    
    const cardsWithArts = cards.map(item => {
      const faces = item.card_name.split(" // ");
      const frontName = faces[0];
      const backName = faces.length > 1 ? faces[1] : null;

      const frontArt = proxyArts.find(a => a.card_name === frontName);
      const backArt = backName ? proxyArts.find(a => a.card_name === backName) : null;

      return {
        ...item,
        mpcfill_id: frontArt?.mpcfill_id || null,
        mpcfill_name: frontArt?.mpcfill_name || null,
        mpcfill_query: frontArt?.mpcfill_query || null,
        mpcfill_back_id: backArt?.mpcfill_id || null,
        mpcfill_back_name: backArt?.mpcfill_name || null,
        mpcfill_back_query: backArt?.mpcfill_query || null
      };
    });

    res.json(cardsWithArts);
  } catch (err) {
    console.error(" Failed to fetch wishlist cards:", err);
    res.status(500).json({ error: "Failed to fetch wishlist cards" });
  }
});

// POST /api/collection/wishlist
router.post("/", requireAuth, async (req, res) => {
  const { id, card_name, quantity, set_code, collector_number, is_foil, card_condition, card_language } = req.body;

  if (!card_name) {
    return res.status(400).json({ error: "card_name is required" });
  }

  const normSetCode = (set_code || "").trim().toUpperCase();
  const normCollectorNum = (collector_number || "").trim();
  const normFoil = !!is_foil;
  const normCondition = card_condition || "NM";
  const normLanguage = card_language || "EN";

  try {
    if (id) {
      // Direct row update by ID
      const existing = await db("user_cards")
        .where({ id, user_id: req.user.id })
        .first();

      if (!existing) {
        return res.status(404).json({ error: "Card row not found" });
      }

      const newQty = quantity !== undefined ? Math.max(0, quantity) : existing.quantity;

      if (newQty <= 0) {
        await db("user_cards").where({ id }).delete();
        return res.json({ message: "Card removed due to zero quantity", deleted: true });
      }

      const [updated] = await db("user_cards")
        .where({ id })
        .update({
          quantity: newQty,
          set_code: normSetCode,
          collector_number: normCollectorNum,
          is_foil: normFoil,
          card_condition: normCondition,
          card_language: normLanguage,
          updated_at: db.fn.now()
        })
        .returning("*");

      return res.json(updated);
    } else {
      // Adding/Incrementing card from Search autocomplete
      const existing = await db("user_cards")
        .where({
          user_id: req.user.id,
          card_name,
          list_type: "wishlist",
          set_code: normSetCode,
          is_foil: normFoil,
          card_condition: normCondition,
          card_language: normLanguage
        })
        .first();

      if (existing) {
        const addQty = quantity !== undefined ? Math.max(1, quantity) : 1;
        const [updated] = await db("user_cards")
          .where({ id: existing.id })
          .update({
            quantity: existing.quantity + addQty,
            collector_number: normCollectorNum || existing.collector_number,
            updated_at: db.fn.now()
          })
          .returning("*");
        return res.json(updated);
      } else {
        const [inserted] = await db("user_cards")
          .insert({
            user_id: req.user.id,
            card_name,
            list_type: "wishlist",
            quantity: quantity !== undefined ? Math.max(1, quantity) : 1,
            set_code: normSetCode,
            collector_number: normCollectorNum,
            is_foil: normFoil,
            card_condition: normCondition,
            card_language: normLanguage
          })
          .returning("*");
        return res.json(inserted);
      }
    }
  } catch (err) {
    console.error(" Failed to add/update wishlist card:", err);
    res.status(500).json({ error: "Failed to save card details" });
  }
});

// DELETE /api/collection/wishlist
router.delete("/", requireAuth, async (req, res) => {
  const { id, card_name, clear_all } = req.body;

  if (!id && !card_name && !clear_all) {
    return res.status(400).json({ error: "id, card_name, or clear_all is required" });
  }

  try {
    let deletedCount = 0;
    if (clear_all) {
      deletedCount = await db("user_cards")
        .where({ user_id: req.user.id, list_type: "wishlist" })
        .delete();
    } else if (id) {
      deletedCount = await db("user_cards")
        .where({ id, user_id: req.user.id, list_type: "wishlist" })
        .delete();
    } else {
      deletedCount = await db("user_cards")
        .where({ user_id: req.user.id, card_name, list_type: "wishlist" })
        .delete();
    }

    if (deletedCount === 0 && !clear_all) {
      return res.status(404).json({ error: "Card not found in wishlist" });
    }

    res.json({ message: "Card(s) deleted successfully", deleted: true, count: deletedCount });
  } catch (err) {
    console.error(" Failed to delete wishlist card:", err);
    res.status(500).json({ error: "Failed to delete card" });
  }
});

// GET /api/collection/wishlist/overlap
router.get("/overlap", requireAuth, async (req, res) => {
  try {
    // Fetch overlapping cards (wishlist + owned)
    const overlaps = await db.raw(`
      SELECT 
        w.card_name,
        (SELECT SUM(quantity) FROM user_cards WHERE user_id = ? AND list_type = 'wishlist' AND card_name = w.card_name) as wishlist_qty,
        (SELECT SUM(quantity) FROM user_cards WHERE user_id = ? AND list_type = 'owned' AND card_name = w.card_name) as owned_qty
      FROM user_cards w
      WHERE w.user_id = ? AND w.list_type = 'wishlist'
      AND EXISTS (SELECT 1 FROM user_cards WHERE user_id = ? AND list_type = 'owned' AND card_name = w.card_name)
      GROUP BY w.card_name
    `, [req.user.id, req.user.id, req.user.id, req.user.id]);

    if (overlaps.length === 0) {
      return res.json({ count: 0, cards: [] });
    }

    // For each overlapping card, find which synced deck(s) placed it on the wishlist
    const cardNames = overlaps.map(r => r.card_name);
    const deckSourceRows = await db("user_archidekt_deck_items as di")
      .join("user_archidekt_decks as d", function() {
        this.on("d.deck_id", "=", "di.deck_id").andOn("d.user_id", "=", "di.user_id");
      })
      .where("di.user_id", req.user.id)
      .where("di.list_type", "wishlist")
      .whereIn("di.card_name", cardNames)
      .select("di.card_name", "d.deck_name", "d.deck_id");

    // Group deck names by card name
    const decksByCard = {};
    for (const row of deckSourceRows) {
      if (!decksByCard[row.card_name]) decksByCard[row.card_name] = [];
      // Avoid duplicate deck names
      if (!decksByCard[row.card_name].some(d => d.deck_id === row.deck_id)) {
        decksByCard[row.card_name].push({ deck_id: row.deck_id, deck_name: row.deck_name });
      }
    }

    res.json({
      count: overlaps.length,
      cards: overlaps.map(r => ({
        name: r.card_name,
        wishlist_qty: r.wishlist_qty,
        owned_qty: r.owned_qty,
        source_decks: decksByCard[r.card_name] || []
      }))
    });
  } catch (err) {
    console.error(" Failed to fetch wishlist overlap:", err);
    res.status(500).json({ error: "Failed to fetch wishlist overlap" });
  }
});

export default router;
