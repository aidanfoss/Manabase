import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/collection/owned
router.get("/", requireAuth, async (req, res) => {
  try {
    const listType = req.query.list_type || "owned";
    const cards = await db("user_cards")
      .where({ user_id: req.user.id, list_type: listType })
      .orderBy("card_name", "asc");
    res.json(cards);
  } catch (err) {
    console.error(" Failed to fetch owned cards:", err);
    res.status(500).json({ error: "Failed to fetch owned cards" });
  }
});

// POST /api/collection/owned
router.post("/", requireAuth, async (req, res) => {
  const { id, card_name, quantity, set_code, collector_number, is_foil, card_condition, card_language, list_type } = req.body;

  if (!card_name) {
    return res.status(400).json({ error: "card_name is required" });
  }

  const normSetCode = (set_code || "").trim().toUpperCase();
  const normCollectorNum = (collector_number || "").trim();
  const normFoil = !!is_foil;
  const normCondition = card_condition || "NM";
  const normLanguage = card_language || "EN";
  const normListType = list_type || "owned";

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
      // Adding/Incrementing card from Search autocomplete or Import
      const existing = await db("user_cards")
        .where({
          user_id: req.user.id,
          card_name,
          list_type: normListType,
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
            list_type: normListType,
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
    console.error(" Failed to add/update owned card:", err);
    res.status(500).json({ error: "Failed to save card details" });
  }
});

// POST /api/collection/owned/bulk
router.post("/bulk", requireAuth, async (req, res) => {
  const { cards } = req.body;
  if (!Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: "cards array is required" });
  }

  try {
    let addedCount = 0;
    await db.transaction(async (trx) => {
      for (const card of cards) {
        if (!card.card_name) continue;

        const card_name = card.card_name.trim();
        const normSetCode = (card.set_code || "").trim().toUpperCase();
        const normCollectorNum = (card.collector_number || "").trim();
        const normFoil = !!card.is_foil;
        const normCondition = card.card_condition || "NM";
        const normLanguage = (card.card_language || "EN").toUpperCase();
        const quantity = Math.max(1, parseInt(card.quantity) || 1);

        const listType = card.list_type || "owned";

        const existing = await trx("user_cards")
          .where({
            user_id: req.user.id,
            card_name,
            list_type: listType,
            set_code: normSetCode,
            is_foil: normFoil,
            card_condition: normCondition,
            card_language: normLanguage
          })
          .first();

        if (existing) {
          await trx("user_cards")
            .where({ id: existing.id })
            .update({
              quantity: existing.quantity + quantity,
              collector_number: normCollectorNum || existing.collector_number,
              updated_at: trx.fn.now()
            });
        } else {
          await trx("user_cards")
            .insert({
              user_id: req.user.id,
              card_name,
              list_type: listType,
              quantity,
              set_code: normSetCode,
              collector_number: normCollectorNum,
              is_foil: normFoil,
              card_condition: normCondition,
              card_language: normLanguage
            });
        }
        addedCount += quantity;
      }
    });

    res.json({ message: "Bulk import completed successfully", count: addedCount });
  } catch (err) {
    console.error(" Bulk import failed:", err);
    res.status(500).json({ error: "Failed to perform bulk import" });
  }
});

// DELETE /api/collection/owned
router.delete("/", requireAuth, async (req, res) => {
  const { id, card_name, clear_all, list_type } = req.body;
  
  const targetListType = list_type || "owned";

  if (!id && !card_name && !clear_all) {
    return res.status(400).json({ error: "id, card_name, or clear_all is required" });
  }

  try {
    let deletedCount = 0;
    if (clear_all) {
      deletedCount = await db("user_cards")
        .where({ user_id: req.user.id, list_type: targetListType })
        .delete();
    } else if (id) {
      deletedCount = await db("user_cards")
        .where({ id, user_id: req.user.id, list_type: targetListType })
        .delete();
    } else {
      deletedCount = await db("user_cards")
        .where({ user_id: req.user.id, card_name, list_type: targetListType })
        .delete();
    }

    if (deletedCount === 0 && !clear_all) {
      return res.status(404).json({ error: "Card not found in owned collection" });
    }

    res.json({ message: "Card(s) deleted successfully", deleted: true, count: deletedCount });
  } catch (err) {
    console.error(" Failed to delete owned card:", err);
    res.status(500).json({ error: "Failed to delete card" });
  }
});

export default router;
