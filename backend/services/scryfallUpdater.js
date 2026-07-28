import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const DATA_DIR = path.resolve("data");
const BULK_PATH = path.join(DATA_DIR, "scryfall-default-cards.json");
const PRICE_PATH = path.join(DATA_DIR, "cardPrices.json");

// Helper to safely read JSON from disk
function readJsonSafe(file, fallback) {
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
        console.error("JSON read failed:", file, err);
        return fallback;
    }
}

const PARSED_CACHE_PATH = path.join(DATA_DIR, "scryfall-parsed-cache.json");

/**
 *  Update bulk data if missing or older than 7 days.
 * Downloads and saves the latest Scryfall "default-cards" dataset.
 */
export async function updateBulkDataIfNeeded() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

        const stats = fs.existsSync(BULK_PATH) ? fs.statSync(BULK_PATH) : null;
        const lastModified = stats ? new Date(stats.mtime) : new Date(0);
        const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (Date.now() - lastModified.getTime() < oneWeek) {
// console.log("️ Bulk data already up to date (checked within 7 days).");
            return;
        }

// console.log("️  Downloading new Scryfall bulk data metadata...");
        const meta = await fetch("https://api.scryfall.com/bulk-data/default-cards", { headers: { "User-Agent": "Manabase/1.0" } }).then(r => r.json());
        const url = meta.download_uri;
// console.log(" Downloading cards from:", url);

        const { pipeline } = await import("stream/promises");
        const res = await fetch(url, { headers: { "User-Agent": "Manabase/1.0" } });
        if (!res.ok) throw new Error(`unexpected response ${res.statusText}`);
        await pipeline(res.body, fs.createWriteStream(BULK_PATH));
        
        // Remove stale parsed cache to trigger rebuild
        if (fs.existsSync(PARSED_CACHE_PATH)) {
            fs.unlinkSync(PARSED_CACHE_PATH);
        }

// console.log(" Scryfall bulk data updated successfully.");
    } catch (err) {
        console.error(" Failed to update Scryfall bulk data:", err);
    }
}

import { chain } from "stream-chain";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/stream-array.js";

/**
 *  Load all cards from the bulk data file into memory.
 * Uses fast pre-parsed cache file if available, or streams raw bulk data to generate cache.
 */
export async function loadCardData() {
    //  Fast path: load pre-parsed stripped cache in ~150ms if it exists
    if (fs.existsSync(PARSED_CACHE_PATH)) {
        try {
// console.log(" Loading cards from fast pre-parsed cache...");
            const data = JSON.parse(fs.readFileSync(PARSED_CACHE_PATH, "utf8"));
// console.log(` Loaded ${data.length.toLocaleString()} cards instantly from cache.`);
            return data;
        } catch (err) {
            console.warn("️ Fast cache read failed, falling back to raw stream:", err.message);
        }
    }

    //  Slow path: stream 557MB raw bulk data file and generate fast cache
    return new Promise((resolve, reject) => {
        const cards = [];
        if (!fs.existsSync(BULK_PATH)) {
// console.log("️ No bulk data found to load.");
            return resolve([]);
        }

// console.log(" Building fast pre-parsed cache from raw bulk data (this happens once)...");
        const pipeline = chain([
            fs.createReadStream(BULK_PATH),
            parser(),
            streamArray()
        ]);

        const writeStream = fs.createWriteStream(PARSED_CACHE_PATH);
        writeStream.write('[\n');
        let isFirst = true;

        pipeline.on("data", (data) => {
            const c = data.value;
            // Only keep fields needed by scryfallLocal.js to prevent OOM
            const stripped = {
                id: c.id,
                oracle_id: c.oracle_id,
                name: c.name,
                layout: c.layout,
                released_at: c.released_at,
                set: c.set,
                set_name: c.set_name,
                promo: c.promo,
                full_art: c.full_art,
                border_color: c.border_color,
                collector_number: c.collector_number,
                prices: c.prices,
                type_line: c.type_line,
                color_identity: c.color_identity,
                scryfall_uri: c.scryfall_uri,
                rulings_uri: c.rulings_uri,
                purchase_uris: c.purchase_uris,
            };
            
            if (c.image_uris) {
                stripped.image_uris = {
                    normal: c.image_uris.normal,
                    small: c.image_uris.small
                };
            }
            
            if (c.card_faces) {
                stripped.card_faces = c.card_faces.map(f => ({
                    image_uris: f.image_uris ? { normal: f.image_uris.normal } : null
                }));
            }
            
            cards.push(stripped);

            const prefix = isFirst ? "" : ",\n";
            isFirst = false;
            
            // Write directly to file stream to avoid generating a massive JSON string in memory
            const canWrite = writeStream.write(prefix + JSON.stringify(stripped));
            if (!canWrite) {
                pipeline.pause();
                writeStream.once("drain", () => pipeline.resume());
            }
        });

        pipeline.on("end", () => {
            console.log(`📚 Streamed ${cards.length.toLocaleString()} cards. Saving fast cache...`);
            try {
                fs.writeFileSync(PARSED_CACHE_PATH, JSON.stringify(cards));
                console.log("💾 Saved pre-parsed cache for instant future startups.");
            } catch (err) {
                console.warn("⚠️ Failed to write pre-parsed cache file:", err.message);
            }
            resolve(cards);
        });

        pipeline.on("error", (err) => {
            console.error("️ Failed to load bulk data:", err);
            resolve([]); // fallback
        });
        
        writeStream.on("error", (err) => {
            console.warn("⚠️ Failed to write pre-parsed cache file:", err.message);
            resolve(cards);
        });
    });
}

/**
 *  Refresh prices for any cards older than 7 days in the cache.
 */
export async function refreshOldPrices() {
    const priceCache = readJsonSafe(PRICE_PATH, {});
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;

    const needsUpdate = Object.entries(priceCache)
        .filter(([_, info]) => now - (info.lastUpdated || 0) > week)
        .map(([id]) => id);

    if (needsUpdate.length === 0) {
// console.log(" All prices up-to-date.");
        return;
    }

// console.log(` Updating prices for ${needsUpdate.length} cards...`);

    for (const id of needsUpdate.slice(0, 200)) { // limit batch
        try {
            const card = await fetch(`https://api.scryfall.com/cards/${id}`, { headers: { "User-Agent": "Manabase/1.0" } }).then(r => r.json());
            const price = card.prices?.usd || card.prices?.usd_foil || null;
            if (price) {
                priceCache[id] = {
                    price,
                    lastUpdated: now,
                };
// console.log(` ${card.name}: $${price}`);
            }
        } catch (err) {
            console.warn(`️ Failed to update price for ${id}: ${err.message}`);
        }
    }

    fs.writeFileSync(PRICE_PATH, JSON.stringify(priceCache, null, 2));
// console.log(" Price cache updated.");
}
