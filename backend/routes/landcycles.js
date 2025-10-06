import express from "express";
import fs from "fs";
import path from "path";
import { readJsonSafe } from "../utils/safeJson.js";

const router = express.Router();
const landDir = path.resolve("data/landcycles");

router.get("/", (req, res) => {
    try {
        const cycles = fs.readdirSync(landDir)
            .filter(f => f.endsWith(".json"))
            .map(f => readJsonSafe(path.join(landDir, f)))
            .filter(Boolean);

        res.json(cycles);
    } catch (err) {
        console.error("Failed to load land cycles:", err);
        res.status(500).json({ error: "Could not load land cycles" });
    }
});

export default router;
