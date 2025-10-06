import fs from "fs";
import path from "path";

export function readJsonSafe(filePath) {
    try {
        const raw = fs.readFileSync(path.resolve(filePath), "utf-8").replace(/^\uFEFF/, "");
        return JSON.parse(raw);
    } catch (err) {
        console.error(`Failed to parse ${filePath}:`, err.message);
        return null;
    }
}
