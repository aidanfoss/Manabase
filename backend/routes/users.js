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
    res.json({ 
      id: user.id, 
      email: user.email, 
      username: user.username,
      archidekt_username: user.archidekt_username,
      archidekt_id: user.archidekt_id,
      archidekt_tag_mappings: typeof user.archidekt_tag_mappings === 'string' ? JSON.parse(user.archidekt_tag_mappings) : (user.archidekt_tag_mappings || {}),
      avatar_url: user.avatar_url || null,
      default_card_back: user.default_card_back || "b:black lotus"
    });
  } catch (err) {
    console.error(" Error fetching current user:", err.message);
    res.status(404).json({ error: "User profile not found" });
  }
});

// Update user default card back
router.put("/me/card-back", requireAuth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Invalid user token" });
    }
    const { default_card_back } = req.body;
    const cardBackVal = (default_card_back || "").trim();

    await db("users")
      .where({ id: req.user.id })
      .update({ default_card_back: cardBackVal });

    res.json({ success: true, default_card_back: cardBackVal });
  } catch (err) {
    console.error(" Error updating default card back:", err.message);
    res.status(500).json({ error: "Failed to update default card back" });
  }
});

export default router;
