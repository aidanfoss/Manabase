import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { readJsonSafe } from "../utils/safeJson.js";
import { fetchCardData } from "../services/scryfall.js";
import { landCyclePresets } from "../data/landcycles.js";

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

// GET land cycle presets
router.get("/presets", async (req, res) => {
    // Parse selected state from query params
    const { packages = '', landcycles = '', colors = '' } = req.query;

    const selectedPackages = packages.split(',').filter(Boolean);
    const selectedLandcycles = landcycles.split(',').filter(Boolean);
    const selectedColors = colors.split(',').filter(Boolean);

    try {
        // Get cards that would be shown for each preset with current selection
        const presetPrices = await Promise.all(
            landCyclePresets.map(async (preset) => {
                // Create a mock query that combines preset landcycles with user selections
                const presetQuery = {
                    packages: selectedPackages,
                    landcycles: Object.keys(preset.landCycles), // Use preset land cycles
                    colors: selectedColors.length === 0 ? ['colorless'] : selectedColors
                };

                // Fetch the actual cards the builder would show
                const cardsURL = new URL(`http://localhost:${process.env.PORT || 8080}/api/cards`);
                cardsURL.searchParams.append('packages', presetQuery.packages.join(','));
                presetQuery.landcycles.forEach(lc => cardsURL.searchParams.append('landcycles', lc));
                presetQuery.colors.forEach(c => cardsURL.searchParams.append('colors', c));

                const cardsResponse = await fetch(cardsURL.toString());

                if (!cardsResponse.ok) {
                    console.error(`Failed to fetch cards for preset ${preset.name}`);
                    return { ...preset, price: 0 };
                }

                const cardsData = await cardsResponse.json();

                // Calculate total price from all lands
                let totalPrice = 0;
                if (Array.isArray(cardsData)) {
                    // Old format => all lands
                    cardsData.forEach(card => {
                        const price = card.price || card.prices?.usd || 0;
                        totalPrice += parseFloat(price) || 0;
                    });
                } else if (cardsData?.lands) {
                    // New format
                    cardsData.lands.forEach(card => {
                        const price = card.price || card.prices?.usd || 0;
                        totalPrice += parseFloat(price) || 0;
                    });
                }

                return {
                    ...preset,
                    price: Math.round(totalPrice * 100) / 100
                };
            })
        );

        res.json(presetPrices);
    } catch (error) {
        console.error('Error calculating preset prices:', error);
        res.status(500).json({ error: 'Failed to calculate preset prices' });
    }
});

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

            // Use the data directly from the JSON file
            const data = await readJsonSafe(filePath);
            cycles.push({
                id: data.id || id,
                name: data.name || toName(id),
                tier: data.tier || "budget",
                description: data.description || "",
                fetchable: data.fetchable || fetchable,
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
