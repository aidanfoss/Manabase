import express from "express";
import { getCache, setCache, isExpired } from "../utils/cacheHandler.js";

const router = express.Router();

// Fetch a specific card by name
router.get("/card/:name", async (req, res) => {
    const { name } = req.params;
    const cacheKey = `card-${name.toLowerCase()}`;

    if (!isExpired(cacheKey)) return res.json(getCache(cacheKey).data);

    try {
        const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
        const data = await response.json();
        setCache(cacheKey, data);
        res.json(data);
    } catch (err) {
        console.error("Scryfall error:", err);
        res.status(500).json({ error: "Failed to fetch card data." });
    }
});

// Search cards
router.get("/search", async (req, res) => {
    const { q } = req.query;
    const cacheKey = `search-${q}`;

    if (!isExpired(cacheKey)) return res.json(getCache(cacheKey).data);

    try {
        const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`);
        const data = await response.json();
        setCache(cacheKey, data);
        res.json(data);
    } catch (err) {
        console.error("Scryfall search error:", err);
        res.status(500).json({ error: "Failed to fetch search data." });
    }
});

export default router;
