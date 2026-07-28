import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readJsonSafe } from "../utils/safeJson.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, "landcycles.json");

const landcycles = readJsonSafe(jsonPath, []);
const masterLands = new Set();

for (const lc of landcycles) {
  for (const c of lc.cards) {
    if (typeof c === 'string') {
        masterLands.add(c);
    } else if (c?.name) {
        masterLands.add(c.name);
    }
  }
}

// Default preset structure for EDH mana bases
export const createPreset = (name, description, landCycles, userId = null) => ({
  id: `preset_${Date.now()}`,
  name,
  description,
  userId, // null for built-in presets
  landCycles, // object like { "cycle-shock-land": 4, "cycle-pain-land": 8 }
  packages: [], // Future: selected packages that could affect pricing/cost
  colorRequirements: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export const allLandNames = Array.from(masterLands);
export const landCyclePresets = []; // No hardcoded presets as per requirements

export default landcycles;
