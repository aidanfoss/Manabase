// backend/routes/users.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Get logged-in user info
router.get("/me", requireAuth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Invalid user token" });
    }
    const user = await db("users").where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user.id, email: user.email, username: user.username, avatar_url: user.avatar_url || null });
  } catch (err) {
    console.error("❌ Error fetching current user:", err.message);
    res.status(404).json({ error: "User profile not found" });
  }
});

export default router;
