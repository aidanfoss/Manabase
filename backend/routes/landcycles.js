import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { readJsonSafe } from "../utils/safeJson.js";
import { fetchCardData } from "../services/scryfall.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LANDCYCLES_DIR = path.resolve(__dirname, "../data/landcycles");
const META_INDEX_FILE = path.resolve(__dirname, "../data/landcycles.index.json");

function toId(filename) {
    return filename.replace(/\.json$/i, "");
}
function toName(id) {
    return id.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// 🔧 reconstruct card names from numeric-key objects
function normalizeCard(card) {
    if (typeof card === "string") return { name: card, fetchable: false };
    if (card?.name) return card;

    const name = Object.keys(card)
        .filter((k) => !isNaN(k))
        .sort((a, b) => a - b)
        .map((k) => card[k])
        .join("");

    return { name, fetchable: card.fetchable ?? false };
}

router.get("/", async (_req, res) => {
    try {
        const files = await fs.readdir(LANDCYCLES_DIR);
        const metaIndex = await readJsonSafe(META_INDEX_FILE);

        const cycles = [];

        for (const f of files) {
            if (!f.endsWith(".json")) continue;

            const id = toId(f);
            const filePath = path.join(LANDCYCLES_DIR, f);
            const payload = await readJsonSafe(filePath);

            const cards = Array.isArray(payload)
                ? payload.map(normalizeCard)
                : Array.isArray(payload?.cards)
                    ? payload.cards.map(normalizeCard)
                    : [];

            // compute if any are fetchable
            let fetchable = false;
            for (const card of cards) {
                if (!card.name) continue;
                const data = await fetchCardData(card.name);
                if (data?.fetchable) {
                    fetchable = true;
                    break;
                }
            }

            const meta = Array.isArray(metaIndex)
                ? metaIndex.find(
                    (x) =>
                        (x.id || x.name)?.toLowerCase().replace(/\s+/g, "") ===
                        id.toLowerCase()
                )
                : null;

            cycles.push({
                id,
                name: meta?.name || toName(id),
                tier: meta?.tier || "budget",
                description: meta?.description || "",
                fetchable,
                cards,
            });
        }

        cycles.sort((a, b) => a.name.localeCompare(b.name));
        res.json(cycles);
    } catch (err) {
        console.error("❌ /api/landcycles failed:", err);
        res.status(500).json({ error: "Failed to load land cycles" });
    }
});

export default router;
