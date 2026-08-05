/**
 * Manabase Backend Server
 * ---------------------------------
 * Handles all cached card, price, and art API requests for the frontend.
 * Now includes user accounts (auth), user packages, land cycles, and colors.
 * 
 *  Metas have been fully replaced by Packages.
 *     → /api/metas now proxies to /api/packages for backward compatibility.
 */

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not set in production. Refusing to start.");
    process.exit(1);
}

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";

// --- Routes ---
import cardsRouter from "./routes/cards.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import packagesRouter from "./routes/packages.js";
import landcyclesRouter from "./routes/landcycles.js";
import presetsRouter from "./routes/presets.js";
import archidektRouter from "./routes/archidekt.js";
import deckUpdaterRouter from "./routes/deckUpdater.js";

import ownedRouter from "./routes/owned.js";
import wishlistRouter from "./routes/wishlist.js";
import tradelistRouter from "./routes/tradelist.js";
import tradeRouter from "./routes/trade.js";
import playgroupsRouter from "./routes/playgroups.js";
import listsRouter from "./routes/lists.js";
import cardbacksRouter from "./routes/cardbacks.js";
import pricingRouter from "./routes/pricingRoutes.js";
import adminRouter from "./routes/admin.js";
import proxyArtsRouter from "./routes/proxyArts.js";

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
app.set("trust proxy", 1);
const PORT = process.env.PORT || 8080;

// ---------------------------------
// Middleware
// ---------------------------------
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',') 
  : ['http://localhost:5173', 'http://localhost:8080', 'https://manabase.quantumaidan.co.za'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Logging middleware
app.use((req, _res, next) => {
// console.log(`→ ${req.method} ${req.originalUrl}`);
    next();
});

// ---------------------------------
// API Routes
// ---------------------------------

//  Health check
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

//  Authentication & User routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);

app.use("/api/collection/owned", ownedRouter);
app.use("/api/collection/wishlist", wishlistRouter);
app.use("/api/collection/tradelist", tradelistRouter);
app.use("/api/playgroups", playgroupsRouter);
app.use("/api/lists", listsRouter);
app.use("/api/trade", tradeRouter);
app.use("/api/pricing", pricingRouter);
app.use("/api/admin", adminRouter);
app.use("/api/user/proxy-arts", proxyArtsRouter);

//  Packages (User-created or public)
app.use("/api/packages", packagesRouter);

//  Archidekt integration
app.use("/api/archidekt", archidektRouter);

//  Deck Updater
app.use("/api/deck-updater", deckUpdaterRouter);


//  Land cycle routes
app.use("/api/landcycles", landcyclesRouter);

//  User presets routes
app.use("/api/presets", presetsRouter);

//  Prebuilt Cardbacks route & static file serving
app.use("/api/cardbacks", cardbacksRouter);
app.use("/cardbacks", express.static(path.join(__dirname, "data/cardbacks")));

/**
 *  Dynamic Landcycle Loader (kept for backward compatibility)
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

                //  Check Scryfall data to determine if ANY card is fetchable
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
        console.error(" Failed to load landcycles:", err);
        res.status(500).json({ error: "Failed to load landcycles." });
    }
});

//  Cards route (handles fetchable detection internally)
app.use("/api/cards", cardsRouter);

//  Local Scryfall bulk data route (always loaded from local bulk JSON)
app.use("/api/scryfall", scryfallLocal);

// ---------------------------------
//  Static Frontend Serving (React build)
// ---------------------------------
const frontendPath = path.join(__dirname, "frontend/dist");
app.use(express.static(frontendPath));

//  Fallback route for SPA (React)
app.get(/.*/, (req, res) => {
    const indexFile = path.join(frontendPath, "index.html");
// console.log(` Attempting to serve frontend from: ${indexFile}`);

    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        console.error(" Frontend build not found at", indexFile);
        res.status(404).send("Frontend build not found.");
    }
});

// ---------------------------------
// Start Server + Init Database
// ---------------------------------
if (process.env.NODE_ENV !== "test") {
    await initDB();

    //  Start Express server first (non-blocking)
    app.listen(PORT, () => {
// console.log(` Server running on port ${PORT}`);
// console.log(` Routes available:`);
// console.log(`   → /api/health`);
// console.log(`   → /api/auth`);
// console.log(`   → /api/users`);
// console.log(`   → /api/packages`);


// console.log(`   → /api/landcycles`);
// console.log(`   → /api/cards`);
// console.log(`   → /api/scryfall (bulk data search)`);
// console.log(` Serving frontend from: ${frontendPath}`);
    });

    //  Background bulk data + price updates
    (async () => {
        try {
            // Ensure bulk data exists and is up to date (once a week)
            await updateBulkDataIfNeeded();
            const { reloadLocalScryfall } = await import("./routes/scryfallLocal.js");
            await reloadLocalScryfall(true);

            // Refresh old prices (cards not updated in >7 days)
            await refreshOldPrices();

            // Init strictly better cache in background
            const { syncStrictlyBetterData } = await import("./services/deckUpdater.js");
            syncStrictlyBetterData();
            
            // Update land cycles dynamically on boot
            console.log("Starting background land cycles update...");
            exec("npm run update-cycles", { cwd: __dirname }, (error, stdout, stderr) => {
                if (error) {
                    console.error("Error updating land cycles:", error.message);
                } else {
                    console.log("Land cycles updated successfully on boot.");
                }
            });

            // Schedule regular background tasks
            setInterval(async () => {
                await updateBulkDataIfNeeded();
                await reloadLocalScryfall(true);
            }, 7 * 24 * 60 * 60 * 1000); // once a week
            setInterval(refreshOldPrices, 6 * 60 * 60 * 1000);            // every 6 hours

// console.log(" Scheduled bulk data (weekly) and price update (6h) tasks initialized.");
        } catch (err) {
            console.error("️ Failed to initialize Scryfall background updates:", err);
        }
    })();
}

export default app;
