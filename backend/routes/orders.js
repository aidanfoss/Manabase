import express from "express";
import { db } from "../db/connection.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// POST /api/orders/mpcfill - Generate MPC JSON for a playgroup
router.post("/mpcfill", authenticate, async (req, res) => {
  try {
    const { playgroup_id } = req.body;
    if (!playgroup_id) {
      return res.status(400).json({ error: "playgroup_id is required" });
    }

    // Verify user is in playgroup
    const isMember = await db("playgroup_members")
      .where({ playgroup_id, user_id: req.user.id })
      .first();
      
    if (!isMember) {
      return res.status(403).json({ error: "Not a member of this playgroup" });
    }

    // Get all members' proxy_wishlists, ordered by oldest first
    const proxyList = await db("user_lists")
      .join("playgroup_members", "user_lists.user_id", "playgroup_members.user_id")
      .where("playgroup_members.playgroup_id", playgroup_id)
      .andWhere("user_lists.list_kind", "proxy_wishlist")
      .select("user_lists.*")
      .orderBy("user_lists.created_at", "asc");

    // Apply the 612 First-In, First-Printed Cap Logic
    const targetCards = proxyList.slice(0, 612);

    // Build generic JSON format for MPCfill
    const mpcJson = targetCards.map((card, index) => ({
      id: index + 1,
      name: card.card_name,
      owner_id: card.user_id,
      list_id: card.id,
      quantity: 1, // Currently assuming each entry is 1 card
      front: "", // To be populated later by art-drive integrations
      back: "" 
    }));

    // Record the proxy order
    const [orderId] = await db("proxy_orders").insert({
      playgroup_id,
      status: "locked"
    }).returning("id");

    const newOrderId = typeof orderId === "object" ? orderId.id : orderId;

    res.json({
      success: true,
      order_id: newOrderId,
      total_cards: targetCards.length,
      overflow_cards: proxyList.length > 612 ? proxyList.length - 612 : 0,
      json: mpcJson
    });

  } catch (err) {
    console.error("Error generating MPC order:", err);
    res.status(500).json({ error: "Failed to generate MPC order." });
  }
});

export default router;
