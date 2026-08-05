// backend/routes/admin.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/stats", requireAdmin, async (req, res) => {
  try {
    // Basic counts
    const userCount = await db("users").count("id as count").first();
    const playgroupCount = await db("playgroups").count("id as count").first();
    const proxyOrderCount = await db("proxy_orders").count("id as count").first();
    const tradeCount = await db("trades").count("id as count").first();
    const activeDecksCount = await db("user_archidekt_decks").count("id as count").first();
    const userCardsCount = await db("user_cards").count("id as count").first();

    // Recent signups (last 50)
    const recentSignups = await db("users")
      .select("id", "email", "username", "created_at", "google_id", "discord_id")
      .orderBy("created_at", "desc")
      .limit(50);

    res.json({
      metrics: {
        totalUsers: userCount.count || 0,
        totalPlaygroups: playgroupCount.count || 0,
        totalProxyOrders: proxyOrderCount.count || 0,
        totalTrades: tradeCount.count || 0,
        totalDecksSynced: activeDecksCount.count || 0,
        totalCardsTracked: userCardsCount.count || 0,
      },
      recentSignups
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

export default router;
