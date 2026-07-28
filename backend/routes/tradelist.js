import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { fetchCardData } from "../services/scryfall.js";

const router = express.Router();

// GET /api/collection/tradelist
router.get("/", requireAuth, async (req, res) => {
  try {
    const cards = await db("user_cards")
      .where({ user_id: req.user.id, list_type: "tradelist" })
      .orderBy("card_name", "asc");
    res.json(cards);
  } catch (err) {
    console.error(" Failed to fetch tradelist cards:", err);
    res.status(500).json({ error: "Failed to fetch tradelist cards" });
  }
});

// POST /api/collection/tradelist
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
          list_type: "tradelist",
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
        let initialPrice = 0.10;
        try {
          const cardData = await fetchCardData(card_name);
          if (cardData && cardData.prices) {
            initialPrice = normFoil
              ? (parseFloat(cardData.prices.usd_foil) || parseFloat(cardData.prices.usd) || cardData.prices.latest || cardData.prices.lowest || 0.10)
              : (parseFloat(cardData.prices.usd) || parseFloat(cardData.prices.usd_foil) || cardData.prices.latest || cardData.prices.lowest || 0.10);
          }
        } catch (e) {
          console.warn("️ Failed to fetch initial card price on insert:", e.message);
        }

        const [inserted] = await db("user_cards")
          .insert({
            user_id: req.user.id,
            card_name,
            list_type: "tradelist",
            quantity: quantity !== undefined ? Math.max(1, quantity) : 1,
            set_code: normSetCode,
            collector_number: normCollectorNum,
            is_foil: normFoil,
            card_condition: normCondition,
            card_language: normLanguage,
            market_price: Number(initialPrice.toFixed(2)) || 0.10
          })
          .returning("*");
        return res.json(inserted);
      }
    }
  } catch (err) {
    console.error(" Failed to add/update tradelist card:", err);
    res.status(500).json({ error: "Failed to save card details" });
  }
});

// DELETE /api/collection/tradelist
router.delete("/", requireAuth, async (req, res) => {
  const { id, card_name, clear_all } = req.body;

  if (!id && !card_name && !clear_all) {
    return res.status(400).json({ error: "id, card_name, or clear_all is required" });
  }

  try {
    let deletedCount = 0;
    if (clear_all) {
      deletedCount = await db("user_cards")
        .where({ user_id: req.user.id, list_type: "tradelist" })
        .delete();
    } else if (id) {
      deletedCount = await db("user_cards")
        .where({ id, user_id: req.user.id, list_type: "tradelist" })
        .delete();
    } else {
      deletedCount = await db("user_cards")
        .where({ user_id: req.user.id, card_name, list_type: "tradelist" })
        .delete();
    }

    if (deletedCount === 0 && !clear_all) {
      return res.status(404).json({ error: "Card not found in tradelist" });
    }

    res.json({ message: "Card(s) deleted successfully", deleted: true, count: deletedCount });
  } catch (err) {
    console.error(" Failed to delete tradelist card:", err);
    res.status(500).json({ error: "Failed to delete card" });
  }
});

export default router;
