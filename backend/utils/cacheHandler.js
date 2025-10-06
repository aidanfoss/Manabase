import fs from "fs";
import path from "path";

const cacheFile = path.resolve("cache/scryfallCache.json");
let cache = {};

// Load cache from file
if (fs.existsSync(cacheFile)) {
    try {
        cache = JSON.parse(fs.readFileSync(cacheFile));
        console.log("🗃️  Cache loaded from file.");
    } catch (err) {
        console.error("⚠️ Failed to parse cache file:", err);
    }
}

export function getCache(key) {
    return cache[key];
}

export function setCache(key, value) {
    cache[key] = { data: value, timestamp: Date.now() };
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
}

export function isExpired(key, ttlMs = 1000 * 60 * 60 * 6) {
    const item = cache[key];
    if (!item) return true;
    return Date.now() - item.timestamp > ttlMs;
}
