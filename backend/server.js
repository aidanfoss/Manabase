/**
 * Manabase Backend Server
 * ---------------------------------
 * Handles all cached card, price, and art API requests for the frontend.
 * Now includes user accounts (auth), user packages, land cycles, and colors.
 * 
 * 🔄 Metas have been fully replaced by Packages.
 *     → /api/metas now proxies to /api/packages for backward compatibility.
 */

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// --- Local Data Imports ---
import colors from "./data/colors.js";

// --- Routes ---
import cardsRouter from "./routes/cards.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import packagesRouter from "./routes/packages.js";
import landcyclesRouter from "./routes/landcycles.js";
import presetsRouter from "./routes/presets.js";

import ownedRouter from "./routes/owned.js";
import wishlistRouter from "./routes/wishlist.js";
import tradelistRouter from "./routes/tradelist.js";
import tradeRouter from "./routes/trade.js";
import playgroupsRouter from "./routes/playgroups.js";
import listsRouter from "./routes/lists.js";
import cardbacksRouter from "./routes/cardbacks.js";
import pricingRouter from "./routes/pricingRoutes.js";

// --- DB ---
import { initDB } from "./db/connection.js";

// --- Utilities ---
import { readJsonSafe } from "./utils/safeJson.js";
import { fetchCardData } from "./services/scryfall.js";
import { updateBulkDataIfNeeded, refreshOldPrices } from "./services/scryfallUpdater.js";
import scryfallLocal from "./routes/scryfallLocal.js";

// ---------------------------------
// Core Setup
// ---------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", true);
const PORT = process.env.PORT || 8080;

// ---------------------------------
// Middleware
// ---------------------------------
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, _res, next) => {
    console.log(`→ ${req.method} ${req.originalUrl}`);
    next();
});

// ---------------------------------
// API Routes
// ---------------------------------

// ✅ Health check
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

// ✅ Authentication & User routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);

app.use("/api/collection/owned", ownedRouter);
app.use("/api/collection/wishlist", wishlistRouter);
app.use("/api/collection/tradelist", tradelistRouter);
app.use("/api/playgroups", playgroupsRouter);
app.use("/api/lists", listsRouter);
app.use("/api/trade", tradeRouter);
app.use("/api/pricing", pricingRouter);

// ✅ Packages (User-created or public)
app.use("/api/packages", packagesRouter);

// ✅ Backward compatibility: /api/metas now points to /api/packages
app.use("/api/metas", packagesRouter);

// ✅ Simple color endpoint
app.get("/api/colors", (_req, res) => res.json(colors));

// ✅ Land cycle routes
app.use("/api/landcycles", landcyclesRouter);

// ✅ User presets routes
app.use("/api/presets", presetsRouter);

// ✅ Prebuilt Cardbacks route & static file serving
app.use("/api/cardbacks", cardbacksRouter);
app.use("/cardbacks", express.static(path.join(__dirname, "data/cardbacks")));

/**
 * ✅ Dynamic Landcycle Loader (kept for backward compatibility)
 * Reads all JSON files in /data/landcycles/
 * Returns an array of landcycle objects with tier & untapQuality metadata
 */
app.get("/api/landcycles-old", async (_req, res) => {
    try {
        const landcyclesDir = path.join(__dirname, "data/landcycles");
        const files = fs.readdirSync(landcyclesDir).filter((f) => f.endsWith(".json"));
        const cycles = [];

        for (const file of files) {
            const fullPath = path.join(landcyclesDir, file);
            const json = await readJsonSafe(fullPath);

            if (json && json.name) {
                // Safely handle both string and object cards
                const cards = (json.cards || []).map((c) =>
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

// ✅ Cards route (handles fetchable detection internally)
app.use("/api/cards", cardsRouter);

// ✅ Local Scryfall bulk data route (always loaded from local bulk JSON)
app.use("/api/scryfall", scryfallLocal);

// ---------------------------------
// 🧱 Static Frontend Serving (React build)
// ---------------------------------
const frontendPath = path.join(__dirname, "frontend/dist");
app.use(express.static(frontendPath));

// ✅ Fallback route for SPA (React)
app.get(/.*/, (req, res) => {
    const indexFile = path.join(frontendPath, "index.html");
    console.log(`🧱 Attempting to serve frontend from: ${indexFile}`);

    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        console.error("❌ Frontend build not found at", indexFile);
        res.status(404).send("Frontend build not found.");
    }
});

// ---------------------------------
// Start Server + Init Database
// ---------------------------------
if (process.env.NODE_ENV !== "test") {
    await initDB();

    // ✅ Start Express server first (non-blocking)
    app.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
        console.log(`📦 Routes available:`);
        console.log(`   → /api/health`);
        console.log(`   → /api/auth`);
        console.log(`   → /api/users`);
        console.log(`   → /api/packages`);
        console.log(`   → /api/metas (alias)`);
        console.log(`   → /api/colors`);
        console.log(`   → /api/landcycles`);
        console.log(`   → /api/cards`);
        console.log(`   → /api/scryfall (bulk data search)`);
        console.log(`🌐 Serving frontend from: ${frontendPath}`);
    });

    // ✅ Background bulk data + price updates
    (async () => {
        try {
            // Ensure bulk data exists and is up to date (once a week)
            await updateBulkDataIfNeeded();
            const { reloadLocalScryfall } = await import("./routes/scryfallLocal.js");
            await reloadLocalScryfall(true);

            // Refresh old prices (cards not updated in >7 days)
            await refreshOldPrices();

            // Schedule regular background tasks
            setInterval(async () => {
                await updateBulkDataIfNeeded();
                await reloadLocalScryfall(true);
            }, 7 * 24 * 60 * 60 * 1000); // once a week
            setInterval(refreshOldPrices, 6 * 60 * 60 * 1000);            // every 6 hours

            console.log("⏰ Scheduled bulk data (weekly) and price update (6h) tasks initialized.");
        } catch (err) {
            console.error("⚠️ Failed to initialize Scryfall background updates:", err);
        }
    })();
}

export default app;
