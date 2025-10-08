import fs from "fs";
import fsp from "fs/promises";
import path from "path";

const SCRY = "https://api.scryfall.com";
const CACHE_DIR = path.resolve(process.env.CACHE_DIR || "./src/.cache");
const CACHE_FILE = path.join(process.cwd(), "cache", "scryfall_cache.json");

let cache = {};

try {
    if (fs.existsSync(CACHE_FILE)) {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
        console.log(`🗃️  Loaded ${Object.keys(cache).length} cached Scryfall entries`);
    }
} catch (err) {
    console.error("⚠️ Failed to load Scryfall cache:", err);
}

async function ensureDir() {
    await fsp.mkdir(CACHE_DIR, { recursive: true });
}

async function getCached(key, ttlSeconds) {
    await ensureDir();
    const file = path.join(CACHE_DIR, key + ".json");
    try {
        const st = await fsp.stat(file);
        const age = (Date.now() - st.mtimeMs) / 1000;
        if (age < ttlSeconds) {
            console.log(`💾 Cache hit: ${key}`);
            return JSON.parse(await fsp.readFile(file, "utf8"));
        }
        console.log(`⌛ Cache expired: ${key}`);
    } catch {
        console.log(`🕳️ Cache miss: ${key}`);
    }
    return null;
}

async function setCached(key, value) {
    await ensureDir();
    const file = path.join(CACHE_DIR, key + ".json");
    await fsp.writeFile(file, JSON.stringify(value), "utf8");
    console.log(`💽 Cached new entry: ${key}`);
}

async function httpJson(url) {
    console.log(`🌐 Fetch → ${url}`);
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}

function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ============================================================
// Fetch all printings for a card (cached 24h)
// ============================================================
export async function getPrintsForName(name) {
    const key = "prints_" + slug(name);
    const cached = await getCached(key, 60 * 60 * 24);
    if (cached) return cached;

    try {
        const q = `!"${encodeURIComponent(name)}" unique:prints include:extras`;
        const url = `${SCRY}/cards/search?q=${q}`;
        const data = await httpJson(url);
        await setCached(key, data);
        return data;
    } catch (err) {
        console.error(`❌ Failed to fetch prints for "${name}":`, err.message);
        return null;
    }
}

// ============================================================
// Main card fetcher (fuzzy search + MDFC support)
// ============================================================
export async function getCardWithDetails(cardName) {
    const key = cardName.toLowerCase().trim();
    if (cache[key]) {
        console.log(`💾 In-memory cache hit for "${cardName}"`);
        return cache[key];
    }

    let cardData;
    try {
        const url = `${SCRY}/cards/named?fuzzy=${encodeURIComponent(cardName)}`;
        console.log(`🌍 Fetching Scryfall data for "${cardName}"`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        cardData = await res.json();
    } catch (err) {
        console.warn(`⚠️ Could not resolve card "${cardName}" (${err.message})`);
        return { name: cardName, missing: true };
    }

    console.log(`✅ Received "${cardData.name}" [${cardData.layout}]`);

    const result = {
        name: cardData.name,
        scryfall_uri: cardData.scryfall_uri,
        image: cardData.image_uris?.normal || null,
        price:
            cardData.prices?.usd
                ? parseFloat(cardData.prices.usd)
                : cardData.prices?.usd_foil
                    ? parseFloat(cardData.prices.usd_foil)
                    : null,
        prints_search_uri: cardData.prints_search_uri,
        layout: cardData.layout,
        color_identity: cardData.color_identity || [],
        colors: cardData.colors || [],
        type_line: cardData.type_line,
    };

    if (
        Array.isArray(cardData.card_faces) &&
        cardData.card_faces.length > 1 &&
        ["modal_dfc", "transform", "double_faced_token"].includes(cardData.layout)
    ) {
        console.log(`🔄 "${cardName}" is DFC (${cardData.layout}), merging faces`);
        result.card_faces = cardData.card_faces.map(face => ({
            name: face.name,
            type_line: face.type_line,
            oracle_text: face.oracle_text,
            image_uris: face.image_uris || null,
            colors: face.colors || [],
            color_identity: face.color_identity || [],
        }));

        if (!result.image && cardData.card_faces[0]?.image_uris?.normal)
            result.image = cardData.card_faces[0].image_uris.normal;

        if (
            (!result.color_identity || result.color_identity.length === 0) &&
            cardData.card_faces.some(f => Array.isArray(f.color_identity))
        ) {
            const merged = new Set();
            cardData.card_faces.forEach(f =>
                (f.color_identity || []).forEach(c => merged.add(c))
            );
            result.color_identity = [...merged];
        }
    }

    const isLand = cardData.type_line?.toLowerCase().includes("land");
    if ((!result.color_identity || result.color_identity.length === 0) && !isLand) {
        result.color_identity = ["C"];
        console.log(`🎨 "${cardName}" marked colorless`);
    }

    if (cardData.prices) result.prices = cardData.prices;
    cache[key] = result;

    try {
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        console.log(`📝 Saved cache entry for "${cardName}"`);
    } catch (err) {
        console.error("⚠️ Failed to save cache:", err);
    }

    console.log(
        `🎯 Finalized "${cardName}" | Colors: ${result.color_identity.join(",") || "none"}`
    );
    return result;
}
