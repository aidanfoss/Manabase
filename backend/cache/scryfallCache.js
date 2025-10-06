import fs from "fs";
const CACHE_FILE = "./cache/scryfall.json";
let cacheData = {};

try {
    if (fs.existsSync(CACHE_FILE)) {
        cacheData = JSON.parse(fs.readFileSync(CACHE_FILE));
    }
} catch {
    cacheData = {};
}

function save() {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
}

export default {
    get: (key) => cacheData[key],
    set: (key, value) => {
        cacheData[key] = { ...value, timestamp: Date.now() };
        save();
    },
};
