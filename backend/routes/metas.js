import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();
const metasDir = path.resolve("data/metas");

router.get("/", (req, res) => {
    try {
        const metas = fs.readdirSync(metasDir)
            .filter(f => f.endsWith(".json"))
            .map(f => JSON.parse(fs.readFileSync(path.join(metasDir, f), "utf-8")));
        res.json(metas);
    } catch (err) {
        console.error("Failed to load metas:", err);
        res.status(500).json({ error: "Could not load metas" });
    }
});

export default router;
