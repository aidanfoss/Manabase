// backend/routes/lists.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { fetchCardData } from "../services/scryfall.js";

const router = express.Router();

// GET /api/lists/:type - Fetch items in user list
router.get("/:type", requireAuth, async (req, res) => {
  const { type } = req.params;
  const listType = type === "proxy_wishlist" ? "wishlist" : type; // map to db naming

  if (!["wishlist", "tradelist", "optional_proxies"].includes(listType)) {
    return res.status(400).json({ error: "Invalid list type." });
  }

  try {
    const query = db("user_cards")
      .where({ user_id: req.user.id, list_type: listType });

    query.select("user_cards.*");

    const cards = await query.orderBy("card_name", "asc");
    res.json(cards);
  } catch (err) {
    console.error("Error fetching list:", err);
    res.status(500).json({ error: "Failed to fetch list." });
  }
});

// POST /api/lists - Add/Update item in list
router.post("/", requireAuth, async (req, res) => {
  const { card_name, list_kind, quantity, set_code, collector_number, is_foil, target_owner_id, any_printing } = req.body;
  const listType = list_kind === "proxy_wishlist" ? "wishlist" : list_kind;

  if (!["wishlist", "tradelist", "optional_proxies"].includes(listType)) {
    return res.status(400).json({ error: "Invalid list type." });
  }

  if (!card_name) {
    return res.status(400).json({ error: "card_name is required" });
  }

  try {
    // Find existing based on user, name, list type, and (if trade sandbox) target owner
    const matchCriteria = { user_id: req.user.id, card_name, list_type: listType };

    const existing = await db("user_cards").where(matchCriteria).first();

    if (existing) {
      const [updated] = await db("user_cards")
        .where({ id: existing.id })
        .update({
          quantity: quantity !== undefined ? Math.max(0, quantity) : existing.quantity + 1,
          set_code: set_code !== undefined ? set_code : existing.set_code,
          collector_number: collector_number !== undefined ? collector_number : existing.collector_number,
          is_foil: is_foil !== undefined ? is_foil : existing.is_foil,
          any_printing: any_printing !== undefined ? any_printing : existing.any_printing,
          updated_at: db.fn.now()
        })
        .returning("*");

      if (updated && updated.quantity <= 0) {
        await db("user_cards").where({ id: existing.id }).delete();
        return res.json({ message: "Card removed due to zero quantity", deleted: true });
      }

      return res.json(updated);
    } else {
      let initialPrice = 0.10;
      try {
        const cardData = await fetchCardData(card_name);
        if (cardData && cardData.prices) {
          initialPrice = is_foil
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
          list_type: listType,
          quantity: quantity !== undefined ? Math.max(1, quantity) : 1,
          set_code: set_code || "",
          collector_number: collector_number || "",
          is_foil: !!is_foil,
          any_printing: any_printing !== undefined ? any_printing : true,
          market_price: Number(initialPrice.toFixed(2)) || 0.10,
          target_owner_id: null
        })
        .returning("*");

      return res.json(inserted);
    }
  } catch (err) {
    console.error("Error adding to list:", err);
    res.status(500).json({ error: "Failed to add/update card in list." });
  }
});

// POST /api/lists/bulk - Bulk add/update items in user list
router.post("/bulk", requireAuth, async (req, res) => {
  const { cards, list_kind } = req.body;
  const listType = (list_kind === "proxy_wishlist" || !list_kind) ? "wishlist" : list_kind;

  if (!["wishlist", "tradelist", "optional_proxies"].includes(listType)) {
    return res.status(400).json({ error: "Invalid list type." });
  }

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
        const normAnyPrinting = card.any_printing !== undefined ? !!card.any_printing : (normSetCode === "");
        const quantity = Math.max(1, parseInt(card.quantity) || 1);

        const existing = await trx("user_cards")
          .where({
            user_id: req.user.id,
            card_name,
            list_type: listType,
          })
          .first();

        if (existing) {
          await trx("user_cards")
            .where({ id: existing.id })
            .update({
              quantity: existing.quantity + quantity,
              set_code: normSetCode || existing.set_code,
              collector_number: normCollectorNum || existing.collector_number,
              is_foil: card.is_foil !== undefined ? normFoil : existing.is_foil,
              any_printing: card.any_printing !== undefined ? normAnyPrinting : existing.any_printing,
              updated_at: trx.fn.now(),
            });
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
            console.warn("️ Failed to fetch initial card price on bulk insert:", e.message);
          }

          await trx("user_cards").insert({
            user_id: req.user.id,
            card_name,
            list_type: listType,
            quantity,
            set_code: normSetCode,
            collector_number: normCollectorNum,
            is_foil: normFoil,
            any_printing: normAnyPrinting,
            market_price: Number(initialPrice.toFixed(2)) || 0.10,
            target_owner_id: null,
          });
        }
        addedCount += quantity;
      }
    });

    res.json({ message: "Bulk import completed successfully", count: addedCount });
  } catch (err) {
    console.error("Error bulk adding to list:", err);
    res.status(500).json({ error: "Failed to perform bulk import to list." });
  }
});


// POST /api/lists/set-all-any-printing - Bulk update wishlist items to any_printing = true
router.post("/set-all-any-printing", requireAuth, async (req, res) => {
  try {
    await db("user_cards")
      .where({ user_id: req.user.id, list_type: "wishlist" })
      .update({ any_printing: true, updated_at: db.fn.now() });
    res.json({ success: true, message: "Specific trade printing rules cleared for wishlist." });
  } catch (err) {
    console.error("Error setting any printing:", err);
    res.status(500).json({ error: "Failed to update wishlist." });
  }
});

// POST /api/lists/bulk-delete - Delete multiple cards by ID array
router.post("/bulk-delete", requireAuth, async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array is required" });
  }

  try {
    const deletedCount = await db("user_cards")
      .whereIn("id", ids)
      .andWhere({ user_id: req.user.id })
      .delete();

    res.json({ success: true, count: deletedCount, message: `Successfully deleted ${deletedCount} cards` });
  } catch (err) {
    console.error("Error bulk deleting cards from list:", err);
    res.status(500).json({ error: "Failed to bulk delete cards" });
  }
});

// DELETE /api/lists/:id - Remove item by ID
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const deletedCount = await db("user_cards")
      .where({ id: req.params.id, user_id: req.user.id })
      .delete();

    if (deletedCount === 0) {
      return res.status(404).json({ error: "Card not found in list" });
    }

    res.json({ success: true, message: "Card deleted successfully" });
  } catch (err) {
    console.error("Error deleting card from list:", err);
    res.status(500).json({ error: "Failed to delete card" });
  }
});

export default router;
