import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import axios from "axios";
import { syncDeckInternal } from "../services/archidektSync.js";

const router = express.Router();

// PUT /api/archidekt/config
// Updates the user's archidekt tag mappings
router.put("/config", requireAuth, async (req, res) => {
  const { tag_mappings } = req.body;

  try {
    const updated = await db("users")
      .where({ id: req.user.id })
      .update({
        archidekt_tag_mappings: typeof tag_mappings === 'object' ? JSON.stringify(tag_mappings) : tag_mappings
      });
    
    res.json({ message: "Config updated successfully" });
  } catch (err) {
    console.error(" Failed to update archidekt config:", err);
    res.status(500).json({ error: "Failed to update config" });
  }
});

// GET /api/archidekt/deck/:id
// Proxy to fetch deck metadata (to show user what will be synced and what tags exist)
router.get("/deck/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const response = await axios.get(`https://archidekt.com/api/decks/${id}/`);
    res.json(response.data);
  } catch (err) {
    console.error(" Failed to fetch archidekt deck:", err.message);
    res.status(err.response?.status || 500).json({ error: "Failed to fetch deck from Archidekt" });
  }
});

// POST /api/archidekt/sync/:id
// Syncs a specific deck based on the user's saved tag mappings
router.post("/sync/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { mappings } = req.body; // allows overriding saved mappings for this specific sync

  try {
    const result = await syncDeckInternal(id, req.user.id, mappings);
    res.json({ message: "Sync successful", stats: result.stats });
  } catch (err) {
    console.error(" Failed to sync archidekt deck:", err.message);
    res.status(err.response?.status || 500).json({ error: "Failed to sync deck from Archidekt" });
  }
});

// Get all saved decks for the user
router.get("/decks", requireAuth, async (req, res) => {
  try {
    const decks = await db("user_archidekt_decks")
      .where({ user_id: req.user.id })
      .orderBy("updated_at", "desc");
    res.json(decks);
  } catch (error) {
    console.error("Archidekt fetch decks error:", error.message);
    res.status(500).json({ error: "Failed to fetch saved decks" });
  }
});

// Update deck options without syncing cards
router.put("/decks/:deckId", requireAuth, async (req, res) => {
  try {
    const { is_public, status } = req.body;
    await db("user_archidekt_decks")
      .where({ user_id: req.user.id, deck_id: req.params.deckId })
      .update({
        is_public: is_public,
        status: status,
        updated_at: db.fn.now()
      });
    res.json({ message: "Deck options updated" });
  } catch (error) {
    console.error("Archidekt update deck error:", error.message);
    res.status(500).json({ error: "Failed to update deck options" });
  }
});

export default router;
