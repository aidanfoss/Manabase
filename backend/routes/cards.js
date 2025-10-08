import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { readJsonSafe } from "../utils/safeJson.js";
import { getCardWithDetails } from "../services/scryfall.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// Helper to load all JSONs recursively (metas, landcycles, colors)
// ============================================================
async function loadJsonFiles(dirPath) {
    try {
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        const all = [];
        for (const f of files) {
            const fullPath = path.join(dirPath, f.name);
            if (f.isDirectory()) {
                const inner = await loadJsonFiles(fullPath);
                all.push(...inner);
            } else if (f.name.endsWith(".json")) {
                const data = await readJsonSafe(fullPath);
                if (Array.isArray(data)) all.push(...data);
                else if (data?.cards && Array.isArray(data.cards))
                    all.push(...data.cards);
            }
        }
        return all;
    } catch (err) {
        console.error(`❌ Failed to load ${dirPath}:`, err.message);
        return [];
    }
}

// ============================================================
// Main route
// ============================================================
router.get("/", async (req, res) => {
    console.log("==========================================");
    console.log(`🧠 /api/cards request →`, req.query);

    try {
        let { colors, metas, landcycles } = req.query;

        if (!Array.isArray(colors)) colors = colors ? [colors] : [];
        if (!Array.isArray(metas)) metas = metas ? [metas] : [];
        if (!Array.isArray(landcycles)) landcycles = landcycles ? [landcycles] : [];

        if (colors.length === 0) colors = ["C"];
        console.log(`🎨 Colors: ${colors.join(", ")}`);
        console.log(`📚 Metas: ${metas.join(", ")}`);
        console.log(`🌍 Landcycles: ${landcycles.join(", ")}`);

        const allCards = [];

        // 1️⃣ Load metas
        for (const meta of metas) {
            const metaFile = path.resolve(
                __dirname,
                `../data/metas/${meta.toLowerCase().replace(/\s+/g, "_")}.json`
            );
            console.log(`📂 Loading meta file: ${metaFile}`);
            const metaData = await readJsonSafe(metaFile);
            if (metaData?.staples) {
                console.log(`   ➕ ${metaData.staples.length} staples`);
                allCards.push(...metaData.staples);
            }
            if (metaData?.sideboard) {
                console.log(`   ➕ ${metaData.sideboard.length} sideboard cards`);
                allCards.push(...metaData.sideboard);
            }
        }

        // 2️⃣ Load land cycles
        for (const cycle of landcycles) {
            const normalized = cycle.toLowerCase().replace(/[\s_]+/g, "");
            let cycleFile = path.resolve(__dirname, `../data/landcycles/${normalized}.json`);

            // fallback with underscores
            try {
                await fs.access(cycleFile);
            } catch {
                const underscoreAlt = path.resolve(
                    __dirname,
                    `../data/landcycles/${cycle.toLowerCase().replace(/\s+/g, "_")}.json`
                );
                try {
                    await fs.access(underscoreAlt);
                    cycleFile = underscoreAlt;
                } catch {
                    console.warn(`⚠️ Neither ${cycleFile} nor ${underscoreAlt} exists.`);
                }
            }

            console.log(`📂 Loading landcycle file: ${cycleFile}`);
            const cycleData = await readJsonSafe(cycleFile);
            if (Array.isArray(cycleData)) {
                console.log(`   ➕ ${cycleData.length} lands`);
                allCards.push(...cycleData);
            } else if (cycleData?.cards) {
                console.log(`   ➕ ${cycleData.cards.length} lands`);
                allCards.push(...cycleData.cards);
            }
        }

        // 3️⃣ Load color staples
        const colorDir = path.resolve(__dirname, "../data/colors");
        const colorFiles = await fs.readdir(colorDir).catch(() => []);
        for (const f of colorFiles) {
            if (f.endsWith(".json")) {
                const colorName = f.replace(".json", "").toUpperCase();
                if (colors.includes(colorName)) {
                    const colorData = await readJsonSafe(path.join(colorDir, f));
                    if (Array.isArray(colorData)) {
                        console.log(`🎨 Loaded ${colorData.length} ${colorName} staples`);
                        allCards.push(...colorData);
                    }
                }
            }
        }

        console.log(`📦 Total combined cards before deduping: ${allCards.length}`);

        // --- Deduplicate ---
        const uniqueNames = [...new Set(allCards.map(c => (typeof c === "string" ? c : c.name)))];
        console.log(`🧩 Unique cards: ${uniqueNames.length}`);

        // --- Fetch Scryfall details ---
        const detailedCards = [];
        for (const name of uniqueNames) {
            try {
                console.log(`🌍 Fetching details for "${name}"`);
                const details = await getCardWithDetails(name);
                detailedCards.push({
                    ...details,
                    note:
                        typeof allCards.find(c => c.name === name)?.note === "string"
                            ? allCards.find(c => c.name === name)?.note
                            : null
                });
            } catch (err) {
                console.error(`⚠️ Failed to fetch "${name}":`, err.message);
            }
        }

        console.log(`✅ Detailed cards fetched: ${detailedCards.length}`);

        // --- Separate lands vs nonlands ---
        const lands = [];
        const nonlands = [];
        for (const card of detailedCards) {
            const typeLine = card.type_line?.toLowerCase() || "";
            if (typeLine.includes("land")) lands.push(card);
            else nonlands.push(card);
        }

        // --- Color identity filtering ---
        function passesColorFilter(card) {
            const identity = card.color_identity || [];
            const typeLine = card.type_line?.toLowerCase() || "";

            // Lands with no color identity allowed everywhere
            if (typeLine.includes("land") && identity.length === 0) return true;

            // Colorless artifacts allowed
            if (identity.length === 0 || identity.includes("C")) {
                return colors.includes("C") || colors.length === 5;
            }

            // All colors must be subset of deck colors
            return identity.every(c => colors.includes(c));
        }

        const filteredLands = lands.filter(passesColorFilter);
        const filteredNonlands = nonlands.filter(passesColorFilter);

        console.log(`🎯 Filtered → lands:${filteredLands.length} nonlands:${filteredNonlands.length}`);

        res.json({
            lands: filteredLands,
            nonlands: filteredNonlands
        });
    } catch (err) {
        console.error("❌ Error in /api/cards:", err);
        res.status(500).json({ error: "Failed to fetch cards." });
    }
});

export default router;
