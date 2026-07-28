import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { readJsonSafe } from "../utils/safeJson.js";
import { fetchCardData as getCardWithDetails } from "../services/scryfall.js";
import { db } from "../db/connection.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get("/", async (req, res) => {
// console.log("==========================================");
// console.log(` /api/cards request →`, req.query);

  try {
    let { colors, packages, landcycles } = req.query;

    if (!Array.isArray(colors)) colors = colors ? [colors] : [];
    if (!Array.isArray(packages)) packages = packages ? [packages] : [];
    if (!Array.isArray(landcycles)) landcycles = landcycles ? [landcycles] : [];

    if (colors.length === 0) colors = ["C"];
// console.log(` Colors: ${colors.join(", ")}`);
// console.log(` Packages: ${packages.join(", ")}`);
// console.log(` Landcycles: ${landcycles.join(", ")}`);

    const allCards = [];
    const cardToCycles = {};

    // -----------------------------------------
    // 1️⃣ Packages (replace metas)
    // -----------------------------------------
    for (const pkgId of packages) {
// console.log(` Loading package: ${pkgId}`);
      try {
        // Try DB first
        const pkg = await db("packages").where({ id: pkgId }).first();
        let cards = [];

        if (pkg) {
// console.log(`   → Found package in DB (${pkg.name})`);
          try {
            cards =
              typeof pkg.cards === "string"
                ? JSON.parse(pkg.cards)
                : Array.isArray(pkg.cards)
                ? pkg.cards
                : [];
          } catch {
            cards = [];
          }
        } else {
          // Fallback to JSON file in /data/packages/
          const pkgFile = path.resolve(
            __dirname,
            `../data/packages/${pkgId.toLowerCase().replace(/\s+/g, "_")}.json`
          );
          const pkgData = await readJsonSafe(pkgFile);
          if (pkgData?.cards) cards = pkgData.cards;
          else if (Array.isArray(pkgData)) cards = pkgData;
        }

// console.log(`    ${cards.length} cards from package "${pkgId}"`);
        allCards.push(...cards);
      } catch (err) {
        console.warn(`️ Failed to load package ${pkgId}:`, err.message);
      }
    }

    // -----------------------------------------
    // 2️⃣ Landcycles
    // -----------------------------------------
    const cycleFetchables = {}; // id -> boolean
    const landcyclesPath = path.resolve(__dirname, "../data/landcycles.json");
    const currentLandcyclesData = await readJsonSafe(landcyclesPath, []);

    for (const cycle of landcycles) {
// console.log(` Processing landcycle: ${cycle}`);
      const cycleData = currentLandcyclesData.find(lc => lc.id === cycle);
      
      if (!cycleData) {
        console.warn(`️ Land cycle ${cycle} not found in landcycles.json`);
        continue;
      }

      let names = cycleData.cards || [];
// console.log(`    ${names.length} lands`);
      allCards.push(...names);

      for (const n of names) {
        const k = (typeof n === "string" ? n : n?.name) || "";
        if (!k) continue;
        cardToCycles[k] = cardToCycles[k] || [];
        cardToCycles[k].push(cycle);
      }

      cycleFetchables[cycle] = false;
    }

    // -----------------------------------------
    // 3️⃣ Color staples (Removed per user request to remove default nonland cards)
    // -----------------------------------------


// console.log(` Total combined cards before deduping: ${allCards.length}`);

    // -----------------------------------------
    // Dedup
    // -----------------------------------------
    const uniqueNames = [
      ...new Set(allCards.map((c) => (typeof c === "string" ? c : c.name))),
    ];
// console.log(` Unique cards: ${uniqueNames.length}`);

    // -----------------------------------------
    // Fetch details
    // -----------------------------------------
    const detailedCards = [];
    for (const name of uniqueNames) {
      try {
// console.log(` Fetching details for "${name}"`);
        const details = await getCardWithDetails(name);
        if (!details) continue;

        detailedCards.push({
          ...details,
          note:
            typeof allCards.find((c) => c.name === name)?.note === "string"
              ? allCards.find((c) => c.name === name)?.note
              : null,
        });

        if (details.fetchable && cardToCycles[name]) {
          for (const cid of cardToCycles[name]) {
            cycleFetchables[cid] = true;
          }
        }
      } catch (err) {
        console.error(`️ Failed to fetch "${name}":`, err.message);
      }
    }

// console.log(` Detailed cards fetched: ${detailedCards.length}`);

    // -----------------------------------------
    // Split lands / nonlands
    // -----------------------------------------
    const lands = [];
    const nonlands = [];
    for (const card of detailedCards) {
      const typeLine = card.type_line?.toLowerCase() || "";
      if (typeLine.includes("land")) lands.push(card);
      else nonlands.push(card);
    }

    // -----------------------------------------
    // Color filter
    // -----------------------------------------
    function passesColorFilter(card) {
      const identity = card.color_identity || [];
      const typeLine = card.type_line?.toLowerCase() || "";

      // --- Colorless (no identity) ---
      if (identity.length === 0) return true;

      // --- Pure colorless identity "C" ---
      if (identity.length === 1 && identity[0] === "C") return true;

      // --- Colored cards (including lands) ---
      // Only show if ALL of their identity colors are within the selected ones
      return identity.every((c) => colors.includes(c));
    }



    const filteredLands = lands.filter(passesColorFilter);
    const filteredNonlands = nonlands.filter(passesColorFilter);

// console.log(
//       ` Filtered → lands:${filteredLands.length} nonlands:${filteredNonlands.length}`
//     );

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
    console.error(" Error in /api/cards:", err);
    res.status(500).json({ error: "Failed to fetch cards." });
  }
});

export default router;
