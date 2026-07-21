// backend/routes/lists.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/lists/:type - Fetch items in user list
router.get("/:type", requireAuth, async (req, res) => {
  const { type } = req.params;
  const listType = type === "proxy_wishlist" ? "wishlist" : type; // map to db naming

  if (!["wishlist", "real_list", "trade_sandbox"].includes(listType)) {
    return res.status(400).json({ error: "Invalid list type." });
  }

  try {
    const query = db("user_cards")
      .where({ user_id: req.user.id, list_type: listType });

    if (listType === "trade_sandbox") {
      // Join users to get target owner name
      query.leftJoin("users as targets", "user_cards.target_owner_id", "targets.id")
        .select("user_cards.*", "targets.username as target_owner_name");
    } else {
      query.select("user_cards.*");
    }

    const cards = await query.orderBy("card_name", "asc");
    res.json(cards);
  } catch (err) {
    console.error("Error fetching list:", err);
    res.status(500).json({ error: "Failed to fetch list." });
  }
});

// POST /api/lists - Add/Update item in list
router.post("/", requireAuth, async (req, res) => {
  const { card_name, list_kind, quantity, set_code, collector_number, is_foil, target_owner_id } = req.body;
  const listType = list_kind === "proxy_wishlist" ? "wishlist" : list_kind;

  if (!["wishlist", "real_list", "trade_sandbox"].includes(listType)) {
    return res.status(400).json({ error: "Invalid list type." });
  }

  if (!card_name) {
    return res.status(400).json({ error: "card_name is required" });
  }

  try {
    // Find existing based on user, name, list type, and (if trade sandbox) target owner
    const matchCriteria = { user_id: req.user.id, card_name, list_type: listType };
    if (listType === "trade_sandbox") {
      matchCriteria.target_owner_id = target_owner_id || null;
    }

    const existing = await db("user_cards").where(matchCriteria).first();

    if (existing) {
      const [updated] = await db("user_cards")
        .where({ id: existing.id })
        .update({
          quantity: quantity !== undefined ? Math.max(0, quantity) : existing.quantity + 1,
          set_code: set_code !== undefined ? set_code : existing.set_code,
          collector_number: collector_number !== undefined ? collector_number : existing.collector_number,
          is_foil: is_foil !== undefined ? is_foil : existing.is_foil,
          updated_at: db.fn.now()
        })
        .returning("*");

      if (updated && updated.quantity <= 0) {
        await db("user_cards").where({ id: existing.id }).delete();
        return res.json({ message: "Card removed due to zero quantity", deleted: true });
      }

      return res.json(updated);
    } else {
      const [inserted] = await db("user_cards")
        .insert({
          user_id: req.user.id,
          card_name,
          list_type: listType,
          quantity: quantity !== undefined ? Math.max(1, quantity) : 1,
          set_code: set_code || null,
          collector_number: collector_number || null,
          is_foil: !!is_foil,
          target_owner_id: listType === "trade_sandbox" ? (target_owner_id || null) : null
        })
        .returning("*");

      return res.json(inserted);
    }
  } catch (err) {
    console.error("Error adding to list:", err);
    res.status(500).json({ error: "Failed to add/update card in list." });
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
