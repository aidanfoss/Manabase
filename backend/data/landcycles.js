import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readJsonSafe } from "../utils/safeJson.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = path.join(__dirname, "landcycles");

const landcycles = [];
const masterLands = new Set();

if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
  for (const file of files) {
    const jsonPath = path.join(dir, file);
    const data = readJsonSafe(jsonPath, {});
    const base = file.replace(/\.json$/i, "");
    const normalized = base.toLowerCase().replace(/_/g, "");

    const id = data.id || normalized;
    const name =
      data.name ||
      normalized.charAt(0).toUpperCase() + normalized.slice(1);

    // Build master list of land names for exclusion / extras
    const cards = Array.isArray(data.cards) ? data.cards : [];
    for (const c of cards) {
      if (c?.name) masterLands.add(c.name);
    }

    landcycles.push({
      id,
      name,
      file,
      cards,
      ...data
    });
  }
} else {
  console.warn(`⚠️ landcycles folder not found: ${dir}`);
}

export const allLandNames = Array.from(masterLands);
export default landcycles;
