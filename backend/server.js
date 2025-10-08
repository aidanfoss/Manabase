/**
 * Manabase Backend Server
 * ---------------------------------
 * Handles all cached card, price, and art API requests for the frontend.
 * Includes metas, land cycles, and color staples (WUBRG support).
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// --- Local Data Imports ---
import metas from "./data/metas.js";
import colors from "./data/colors.js";

// --- Routes ---
import cardsRouter from "./routes/cards.js";
import landcyclesRouter from "./routes/landcycles.js";

// --- Utilities ---
import { readJsonSafe } from "./utils/safeJson.js";

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
// API Routes
// ---------------------------------

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Simple category endpoints
app.get("/api/metas", (_req, res) => res.json(metas));
app.get("/api/colors", (_req, res) => res.json(colors));

// Routers
// 👇 This router handles /api/landcycles
app.use("/api/landcycles", landcyclesRouter);

// Cards route
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
