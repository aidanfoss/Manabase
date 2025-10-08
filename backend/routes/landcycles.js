import express from "express";
import landcycles from "../data/landcycles.js";

const router = express.Router();

// GET /api/landcycles
router.get("/", (req, res) => {
  try {
    if (!Array.isArray(landcycles) || landcycles.length === 0) {
      console.warn("⚠️ No landcycles found or loaded");
      return res.json([]);
    }

    // Send minimal list to frontend
    const list = landcycles.map(lc => ({
      id: lc.id,
      name: lc.name
    }));

    console.log(`✅ Sending ${list.length} landcycles`);
    res.json(list);
  } catch (err) {
    console.error("❌ Error loading landcycles:", err);
    res.status(500).json({ error: "Failed to load landcycles" });
  }
});

export default router;
