import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readJsonSafe } from "../utils/safeJson.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = path.join(__dirname, "colors");

const colors = [];

if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    for (const file of files) {
        const jsonPath = path.join(dir, file);
        const data = readJsonSafe(jsonPath, {});
        const name =
            data.name ||
            file
                .replace(/\.json$/i, "")
                .toUpperCase();

        colors.push({
            name,
            code: file.replace(/\.json$/i, ""), // e.g. 'wb', 'w', 'wubrg'
            staples: data.staples || [],
            description: data.description || "",
            ...data
        });
    }
} else {
    console.warn(`⚠️ colors folder not found: ${dir}`);
}

export default colors;
