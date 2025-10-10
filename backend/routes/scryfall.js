// backend/routes/scryfall.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// simple in-memory cache to reduce rate limits
const cache = new Map();

router.get("/", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Missing search query" });

    const key = q.toLowerCase().trim();
    if (cache.has(key)) {
      return res.json(cache.get(key));
    }

    const response = await fetch(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Scryfall API error:", text);
      return res.status(response.status).json({ error: "Scryfall API error" });
    }

    const data = await response.json();
    cache.set(key, data);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(data);
  } catch (err) {
    console.error("❌ Scryfall proxy failed:", err);
    res.status(500).json({ error: "Scryfall fetch failed" });
  }
});

export default router;
