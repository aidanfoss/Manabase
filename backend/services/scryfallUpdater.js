import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const DATA_DIR = path.resolve("data");
const BULK_PATH = path.join(DATA_DIR, "scryfall-default-cards.json");
const PRICE_PATH = path.join(DATA_DIR, "cardPrices.json");

// Helper to read JSON safely
function readJsonSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error("JSON read failed:", file, err);
    return fallback;
  }
}

// Fetch and store the latest bulk data from Scryfall
export async function updateBulkDataIfNeeded() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const stats = fs.existsSync(BULK_PATH) ? fs.statSync(BULK_PATH) : null;
    const lastModified = stats ? new Date(stats.mtime) : new Date(0);
    const oneDay = 24 * 60 * 60 * 1000;

    // Only refresh once every 24 hours
    if (Date.now() - lastModified.getTime() < oneDay) {
      console.log("🗂️ Bulk data already up to date.");
      return;
    }

    console.log("⬇️  Downloading new Scryfall bulk data metadata...");
    const meta = await fetch("https://api.scryfall.com/bulk-data/default-cards").then(r => r.json());
    const url = meta.download_uri;
    console.log("📦 Downloading cards from:", url);

    const text = await fetch(url).then(r => r.text());
    fs.writeFileSync(BULK_PATH, text);
    console.log("✅ Scryfall bulk data updated.");
  } catch (err) {
    console.error("❌ Failed to update Scryfall bulk data:", err);
  }
}

// Load cards into memory
export function loadCardData() {
  try {
    const raw = fs.readFileSync(BULK_PATH, "utf8");
    const cards = JSON.parse(raw);
    console.log(`📚 Loaded ${cards.length} cards from bulk data.`);
    return cards;
  } catch (err) {
    console.error("⚠️ Failed to load bulk data:", err);
    return [];
  }
}

// Update prices for cards that haven't been updated in >7 days
export async function refreshOldPrices() {
  const priceCache = readJsonSafe(PRICE_PATH, {});
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;

  const needsUpdate = Object.entries(priceCache)
    .filter(([id, info]) => now - (info.lastUpdated || 0) > week)
    .map(([id]) => id);

  if (needsUpdate.length === 0) {
    console.log("💰 All prices up-to-date.");
    return;
  }

  console.log(`💰 Updating prices for ${needsUpdate.length} cards...`);

  for (const id of needsUpdate.slice(0, 200)) { // limit batch
    try {
      const card = await fetch(`https://api.scryfall.com/cards/${id}`).then(r => r.json());
      const price = card.prices?.usd || card.prices?.usd_foil || null;
      if (price) {
        priceCache[id] = {
          price,
          lastUpdated: now
        };
        console.log(`🪙 ${card.name}: $${price}`);
      }
    } catch (err) {
      console.warn(`Failed to update price for ${id}:`, err.message);
    }
  }

  fs.writeFileSync(PRICE_PATH, JSON.stringify(priceCache, null, 2));
  console.log("✅ Price cache updated.");
}
