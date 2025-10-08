import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readJsonSafe } from "../utils/safeJson.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Folder containing all the meta JSONs
const dir = path.join(__dirname, "metas");

const metas = [];

if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    for (const file of files) {
        const jsonPath = path.join(dir, file);
        const data = readJsonSafe(jsonPath, {});

        // Fallback: use filename as meta name
        const name =
            data.name ||
            file
                .replace(/\.json$/i, "")
                .replace(/(^[a-z])/,
                    c => c.toUpperCase())
                .replace(/_/g, " ");

        metas.push({
            name,
            staples: data.staples || [],
            sideboard: data.sideboard || [],
            ...data
        });
    }
} else {
    console.warn(`⚠️ metas folder not found: ${dir}`);
}

export default metas;
