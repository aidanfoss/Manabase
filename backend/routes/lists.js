import express from "express";
import { db } from "../db/connection.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// GET /api/lists/:type - Fetch lists
router.get("/:type", authenticate, async (req, res) => {
  const { type } = req.params;
  if (!["proxy_wishlist", "real_list", "trade_sandbox"].includes(type)) {
    return res.status(400).json({ error: "Invalid list type." });
  }

  try {
    const cards = await db("user_lists")
      .where({ user_id: req.user.id, list_kind: type })
      .orderBy("created_at", "desc");
    res.json(cards);
  } catch (err) {
    console.error("Error fetching list:", err);
    res.status(500).json({ error: "Failed to fetch list." });
  }
});

// POST /api/lists - Add card to list
router.post("/", authenticate, async (req, res) => {
  const { card_name, list_kind, target_owner_id } = req.body;
  
  if (!["proxy_wishlist", "real_list", "trade_sandbox"].includes(list_kind)) {
    return res.status(400).json({ error: "Invalid list type." });
  }

  try {
    const [id] = await db("user_lists").insert({
      user_id: req.user.id,
      card_name,
      list_kind,
      target_owner_id: target_owner_id || null
    }).returning("id");

    const newId = typeof id === "object" ? id.id : id;
    res.json({ success: true, id: newId });
  } catch (err) {
    console.error("Error adding to list:", err);
    res.status(500).json({ error: "Failed to add to list." });
  }
});

// DELETE /api/lists/:id - Remove card from list
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const deleted = await db("user_lists")
      .where({ id: req.params.id, user_id: req.user.id })
      .del();
      
    if (!deleted) return res.status(404).json({ error: "Item not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error removing from list:", err);
    res.status(500).json({ error: "Failed to remove item." });
  }
});

export default router;
