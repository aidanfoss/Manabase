import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { readJsonSafe } from "../utils/safeJson.js";
import { fetchCardData as getCardWithDetails } from "../services/scryfall.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        const cardToCycles = {}; // name -> [cycleIds]  <-- NEW

        // 1) metas
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

        // 2) landcycles
        const cycleFetchables = {}; // id -> boolean

        for (const cycle of landcycles) {
            const normalized = cycle.toLowerCase().replace(/[\s_]+/g, "");
            let cycleFile = path.resolve(__dirname, `../data/landcycles/${normalized}.json`);

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
            let names = [];

            if (Array.isArray(cycleData)) {
                console.log(`   ➕ ${cycleData.length} lands`);
                names = cycleData.map((c) => (typeof c === "string" ? c : c.name));
                allCards.push(...cycleData);
            } else if (cycleData?.cards) {
                console.log(`   ➕ ${cycleData.cards.length} lands`);
                names = cycleData.cards.map((c) => (typeof c === "string" ? c : c.name));
                allCards.push(...cycleData.cards);
            }

            for (const n of names) {
                const k = (typeof n === "string" ? n : n?.name) || "";
                if (!k) continue;
                cardToCycles[k] = cardToCycles[k] || [];
                cardToCycles[k].push(cycle); // map this card to this cycle id as requested
            }

            cycleFetchables[cycle] = false; // init
        }

        // 3) color staples
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

        // Dedup
        const uniqueNames = [...new Set(allCards.map((c) => (typeof c === "string" ? c : c.name)))];
        console.log(`🧩 Unique cards: ${uniqueNames.length}`);

        // Fetch details
        const detailedCards = [];
        for (const name of uniqueNames) {
            try {
                console.log(`🌍 Fetching details for "${name}"`);
                const details = await getCardWithDetails(name);
                if (!details) continue;

                detailedCards.push({
                    ...details,
                    note:
                        typeof allCards.find((c) => c.name === name)?.note === "string"
                            ? allCards.find((c) => c.name === name)?.note
                            : null,
                });

                // mark fetchable per-cycle correctly  <-- FIX
                if (details.fetchable && cardToCycles[name]) {
                    for (const cid of cardToCycles[name]) {
                        cycleFetchables[cid] = true;
                    }
                }
            } catch (err) {
                console.error(`⚠️ Failed to fetch "${name}":`, err.message);
            }
        }

        console.log(`✅ Detailed cards fetched: ${detailedCards.length}`);

        // Split lands / nonlands
        const lands = [];
        const nonlands = [];
        for (const card of detailedCards) {
            const typeLine = card.type_line?.toLowerCase() || "";
            if (typeLine.includes("land")) lands.push(card);
            else nonlands.push(card);
        }

        // Color identity filter (now safe; details.color_identity is present)
        function passesColorFilter(card) {
            const identity = card.color_identity || [];
            const typeLine = card.type_line?.toLowerCase() || "";

            if (typeLine.includes("land") && identity.length === 0) return true;
            if (identity.length === 0 || identity.includes("C")) {
                return colors.includes("C") || colors.length === 5;
            }
            return identity.every((c) => colors.includes(c));
        }

        const filteredLands = lands.filter(passesColorFilter);
        const filteredNonlands = nonlands.filter(passesColorFilter);

        console.log(`🎯 Filtered → lands:${filteredLands.length} nonlands:${filteredNonlands.length}`);

        // Optional summary (frontend can merge into its landcycles list)
        const fetchableSummary = Object.entries(cycleFetchables).map(([id, value]) => ({
            id,
            fetchable: value,
        }));

        res.json({
            lands: filteredLands,
            nonlands: filteredNonlands,
            fetchableSummary,
        });
    } catch (err) {
        console.error("❌ Error in /api/cards:", err);
        res.status(500).json({ error: "Failed to fetch cards." });
    }
});

export default router;
