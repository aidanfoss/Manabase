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

// Calculate price helper function (modular for custom presets)
export const calculatePresetPrice = (landCycles, { packages = [], colors = [] }, defaultCounts = {}) => {
  let total = 0;

  // For each land cycle type in the preset, calculate price
  Object.entries(landCycles).forEach(([cycleKey, count]) => {
    if (LAND_PRICING[cycleKey]) {
      total += LAND_PRICING[cycleKey] * count;
    }
  });

  // Add package prices (placeholder - would need actual package pricing)
  // This is easy to extend in the future

  return Math.round(total * 100) / 100;
};

// Default preset structure for EDH mana bases
export const createPreset = (name, description, landCycles, userId = null) => ({
  id: `preset_${Date.now()}`,
  name,
  description,
  userId, // null for built-in presets
  landCycles, // object like { shocklands: 4, painlands: 8, basic: 24 }
  packages: [], // Future: selected packages that could affect pricing/cost
  colorRequirements: [],
  getPrice: (selectedState = {}) => {
    const { packages = [], colors = [] } = selectedState;
    const isMulticolor = colors.size >= 4;
    const defaultCounts = landCycles; // Use the defined counts
    return calculatePresetPrice(defaultCounts, { packages, colors });
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// Land cycle presets for EDH decks (using modular structure)
export const landCyclePresets = [
  createPreset(
    "Precon",
    "Standard precon lands: scrylands, cycle lands, gain lands",
    { scrylands: 4, creaturelands: 4, gainlands: 4 }
  ),
  createPreset(
    "Budget Competitive",
    "Budget competitive mana base: shocks, painlands, bad filters, tainted lands, vergelands",
    { shocklands: 4, painlands: 8, badfilters: 4, taintedlands: 4, vergelands: 4 }
  ),
  createPreset(
    "Maximize Fetchable",
    "Focus on lands that fetch well: fetches, shocks, triomes",
    { fetchlands: 4, shocklands: 4, triomes: 4, checklands: 4 }
  ),
  createPreset(
    "Utility Focused",
    "Lands with utility: gain lands, locus lands, horizon lands",
    { gainlands: 4, lowlifelands: 8, horizonlands: 4 }
  )
];

export const allLandNames = Array.from(masterLands);
export default landcycles;
