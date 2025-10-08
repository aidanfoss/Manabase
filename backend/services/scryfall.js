/**
 * scryfall.js
 * ---------------------------------
 * Rate-limited + disk-cached Scryfall client.
 * Adds:
 *  - fetchable (basic land types)
 *  - color_identity (needed for filtering)
 *  - scryfall_uri (and url/uri aliases for <Card/>)
 *  - latest + lowest prices
 * Cache dir: ./cache/cards/
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const API_BASE = "https://api.scryfall.com";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, "../cache/cards");

await fs.mkdir(CACHE_DIR, { recursive: true });

const memCache = new Map();

// ~8 req/s
let lastRequestTime = 0;
const RATE_LIMIT_DELAY = 125;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function rateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < RATE_LIMIT_DELAY) await delay(RATE_LIMIT_DELAY - elapsed);
    lastRequestTime = Date.now();
}

function sanitizeName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/gi, "_");
}

async function getCached(name) {
    const file = path.join(CACHE_DIR, `${sanitizeName(name)}.json`);
    try {
        const data = await fs.readFile(file, "utf8");
        return JSON.parse(data);
    } catch {
        return null;
    }
}

async function setCached(name, data) {
    const file = path.join(CACHE_DIR, `${sanitizeName(name)}.json`);
    try {
        await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
        console.warn("⚠️ Failed to write cache:", err.message);
    }
}

async function fetchJson(url, retries = 3) {
    await rateLimit();
    const res = await fetch(url);

    if (res.status === 429 && retries > 0) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10) * 1000;
        console.warn(`⏳ Rate limited, retrying in ${retryAfter}ms...`);
        await delay(retryAfter);
        return fetchJson(url, retries - 1);
    }
    if (!res.ok) throw new Error(`Scryfall fetch failed: ${res.status} ${res.statusText}`);
    return res.json();
}

/** Fetch single card with fetchability + pricing, cached to disk */
export async function fetchCardData(name) {
    const key = name.toLowerCase();
    if (memCache.has(key)) return memCache.get(key);

    const cached = await getCached(name);
    if (cached) {
        memCache.set(key, cached);
        return cached;
    }

    try {
        const card = await fetchJson(`${API_BASE}/cards/named?exact=${encodeURIComponent(name)}`);

        const basicTypes = ["Plains", "Island", "Swamp", "Mountain", "Forest"];
        const fetchable = basicTypes.some((b) => (card.type_line || "").includes(b));

        const latestPrice =
            parseFloat(card.prices.usd) ||
            parseFloat(card.prices.usd_foil) ||
            null;

        let lowestPrice = latestPrice;
        let allPrints = [];

        if (card.prints_search_uri) {
            const printsData = await fetchJson(card.prints_search_uri);
            allPrints = printsData.data || [];

            const allPrices = allPrints
                .map((p) =>
                    Math.min(
                        parseFloat(p.prices.usd) || Infinity,
                        parseFloat(p.prices.usd_foil) || Infinity
                    )
                )
                .filter((v) => isFinite(v));

            if (allPrices.length > 0) lowestPrice = Math.min(...allPrices);
        }

        const image =
            card.image_uris?.normal ||
            card.card_faces?.[0]?.image_uris?.normal ||
            null;

        const result = {
            name: card.name,
            oracle_id: card.oracle_id,
            type_line: card.type_line,
            color_identity: card.color_identity ?? [],   // <-- needed by /api/cards filter
            fetchable,                                   // <-- cached fetchability
            set: card.set,
            collector_number: card.collector_number,
            image,
            scryfall_uri: card.scryfall_uri,             // <-- for <Card/> click
            uri: card.scryfall_uri,                      // alias for compatibility
            url: card.scryfall_uri,                      // alias for compatibility
            rulings_uri: card.rulings_uri,
            purchase_uris: card.purchase_uris ?? {},
            prices: {
                latest: latestPrice,
                lowest: lowestPrice,
                usd: card.prices.usd,
                usd_foil: card.prices.usd_foil,
            },
            prints_uri: card.prints_search_uri,
            prints: allPrints.map((p) => ({
                set: p.set,
                set_name: p.set_name,
                collector_number: p.collector_number,
                prices: p.prices,
                released_at: p.released_at,
            })),
        };

        memCache.set(key, result);
        await setCached(name, result);
        return result;
    } catch (err) {
        console.warn(`⚠️ Failed to fetch "${name}": ${err.message}`);
        return null;
    }
}

/** Batch helper */
export async function fetchCardsBatch(names = []) {
    const results = [];
    for (const n of names) {
        const data = await fetchCardData(n);
        if (data) results.push(data);
        await rateLimit();
    }
    return results;
}

export { fetchCardData as getCardWithDetails };
