import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();
const landDir = path.resolve("data/landcycles");

router.get("/", (req, res) => {
    try {
        const cycles = fs.readdirSync(landDir)
            .filter(f => f.endsWith(".json"))
            .map(f => JSON.parse(fs.readFileSync(path.join(landDir, f), "utf-8")));
        res.json(cycles);
    } catch (err) {
        console.error("Failed to load land cycles:", err);
        res.status(500).json({ error: "Could not load land cycles" });
    }
});

export default router;
