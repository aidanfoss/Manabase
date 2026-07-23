import express from "express";
import { scrapeLotusCard, batchScrapeLotusCards } from "../services/lotusvault.js";
import { optimizeManaPoolCart } from "../services/manapool.js";

const router = express.Router();

// GET /api/pricing/lotusvault/search?name=...
router.get("/lotusvault/search", async (req, res) => {
    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ error: "Missing required query parameter 'name'" });
    }

    try {
        const result = await scrapeLotusCard(name);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pricing/lotusvault/batch
router.post("/lotusvault/batch", async (req, res) => {
    const { names } = req.body;
    if (!Array.isArray(names)) {
        return res.status(400).json({ error: "Body must include 'names' array" });
    }

    try {
        const results = await batchScrapeLotusCards(names);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pricing/manapool/optimize
router.post("/manapool/optimize", async (req, res) => {
    const { items, options } = req.body;
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Body must include 'items' array" });
    }

    try {
        const result = await optimizeManaPoolCart(items, options || {});
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
