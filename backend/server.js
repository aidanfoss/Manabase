/**
 * Manabase Backend Server
 * ---------------------------------
 * Handles all cached card, price, and art API requests for the frontend.
 * Includes metas, land cycles, and color staples (WUBRG support).
 */

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// --- Local Data Imports ---
import metas from "./data/metas.js";
import colors from "./data/colors.js";

// --- Routes ---
import cardsRouter from "./routes/cards.js";

// --- Utilities ---
import { readJsonSafe } from "./utils/safeJson.js";
import { fetchCardData } from "./services/scryfall.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// ---------------------------------
// Middleware
// ---------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, _res, next) => {
    console.log(`→ ${req.method} ${req.originalUrl}`);
    next();
});

// ---------------------------------
// Providers (async-friendly)
// ---------------------------------
const metasProvider = async () => metas;
const colorsProvider = async () => colors;

// ---------------------------------
// Utility: Determine if card is fetchable
// ---------------------------------
function isFetchable(card) {
    const basics = ["Plains", "Island", "Swamp", "Mountain", "Forest"];
    return basics.some(type => card.type_line?.includes(type));
}

// ---------------------------------
// API Routes
// ---------------------------------

// ✅ Health check
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

// ✅ Simple category endpoints
app.get("/api/metas", (_req, res) => res.json(metas));
app.get("/api/colors", (_req, res) => res.json(colors));

/**
 * ✅ Dynamic Landcycle Loader
 * Reads all JSON files in /data/landcycles/
 * Returns an array of landcycle objects with tier & untapQuality metadata
 */
app.get("/api/landcycles", async (_req, res) => {
    try {
        const landcyclesDir = path.join(__dirname, "data/landcycles");
        const files = fs.readdirSync(landcyclesDir).filter(f => f.endsWith(".json"));
        const cycles = [];

        for (const file of files) {
            const fullPath = path.join(landcyclesDir, file);
            const json = await readJsonSafe(fullPath);

            if (json && json.name) {
                // Safely handle both string and object cards
                const cards = (json.cards || []).map(c =>
                    typeof c === "string"
                        ? { name: c, fetchable: false }
                        : { name: c.name ?? "", fetchable: c.fetchable ?? false }
                );

                // 🔍 Check Scryfall data to determine if ANY card is fetchable
                let cycleFetchable = false;
                for (const card of cards) {
                    const data = await fetchCardData(card.name);
                    if (data?.fetchable) {
                        cycleFetchable = true;
                        break;
                    }
                }

                cycles.push({
                    id: json.id || path.basename(file, ".json"),
                    name: json.name,
                    tier: json.tier || "budget",
                    untapQuality: json.untapQuality || "unknown",
                    description: json.description || "",
                    fetchable: cycleFetchable,
                    cards,
                });
            }
        }

        // Sort by tier and then alphabetically
        const tierOrder = { premium: 0, playable: 1, budget: 2, unknown: 3 };
        cycles.sort((a, b) => {
            const ta = tierOrder[a.tier?.toLowerCase()] ?? 3;
            const tb = tierOrder[b.tier?.toLowerCase()] ?? 3;
            if (ta !== tb) return ta - tb;
            return a.name.localeCompare(b.name);
        });

        res.json(cycles);
    } catch (err) {
        console.error("❌ Failed to load landcycles:", err);
        res.status(500).json({ error: "Failed to load landcycles." });
    }
});



// ✅ Cards route (will internally mark fetchable too)
app.use("/api/cards", cardsRouter);

// ---------------------------------
// Static Serving (for production builds)
// ---------------------------------
const frontendDir = path.resolve(__dirname, "../frontend/dist");
app.use(express.static(frontendDir));

// Fallback for React Router (Express 5-safe)
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDir, "index.html"));
});

// ---------------------------------
// Start Server
// ---------------------------------
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📦 Routes available:`);
    console.log(`   → /api/health`);
    console.log(`   → /api/metas`);
    console.log(`   → /api/colors`);
    console.log(`   → /api/landcycles`);
    console.log(`   → /api/cards`);
});
