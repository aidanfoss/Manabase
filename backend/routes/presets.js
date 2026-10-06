// backend/routes/presets.js
import express from "express";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { landCyclePresets } from "../data/landcyclesData.js";
import { getLocalCardsBatch } from "./scryfallLocal.js";
import { readJsonSafe } from "../utils/safeJson.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const landcyclesPath = path.resolve(__dirname, "../data/landcycles.json");

let defaultPresetsSeeded = false;

// Seed default presets into database
async function seedDefaultPresets() {
  if (defaultPresetsSeeded) return;
  try {
    const existingCount = await db("default_presets").count("id as count").first();
    const count = typeof existingCount === "object" ? (existingCount.count || Object.values(existingCount)[0]) : existingCount;
    if (parseInt(count, 10) > 0) {
      defaultPresetsSeeded = true;
      return;
    }

    for (const preset of landCyclePresets) {
      await db("default_presets").insert({
        name: preset.name,
        description: preset.description,
        landCycles: JSON.stringify(preset.landCycles),
        packages: JSON.stringify(preset.packages || []),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    defaultPresetsSeeded = true;
  } catch (error) {
    console.error('Error seeding default presets:', error);
  }
}

function passesColorFilter(colorIdentity = [], colors = []) {
  if (colorIdentity.length === 0 || (colorIdentity.length === 1 && colorIdentity[0] === "C")) return true;
  return colorIdentity.every((c) => colors.includes(c));
}

async function enrichPresetsWithPrices(presets, selectedColors) {
  if (!selectedColors || selectedColors.length === 0 || selectedColors.includes("colorless")) {
    return presets;
  }

  try {
    const landcyclesData = await readJsonSafe(landcyclesPath, []);
    const landcyclesMap = new Map(landcyclesData.map(lc => [lc.id, lc.cards || []]));

    // Collect all unique package IDs referenced by presets
    const allPackageIds = [...new Set(presets.flatMap(p => p.packages || []))];
    const dbPackages = allPackageIds.length > 0 ? await db("packages").whereIn("id", allPackageIds) : [];
    const packageCardsMap = new Map();

    for (const pkg of dbPackages) {
      try {
        const cards = typeof pkg.cards === "string" ? JSON.parse(pkg.cards) : (Array.isArray(pkg.cards) ? pkg.cards : []);
        packageCardsMap.set(pkg.id, cards);
      } catch {
        packageCardsMap.set(pkg.id, []);
      }
    }

    // Map each preset to its list of card names
    const presetCardNamesMap = new Map();
    const allCardNames = new Set();

    for (const preset of presets) {
      const names = [];
      // 1. Packages
      for (const pkgId of (preset.packages || [])) {
        const pkgCards = packageCardsMap.get(pkgId) || [];
        for (const c of pkgCards) {
          const n = typeof c === "string" ? c : c?.name;
          if (n) { names.push(n); allCardNames.add(n); }
        }
      }
      // 2. Land cycles
      const cycleKeys = Array.isArray(preset.landCycles) ? preset.landCycles : Object.keys(preset.landCycles || {});
      for (const cycleId of cycleKeys) {
        const cycleCards = landcyclesMap.get(cycleId) || [];
        for (const c of cycleCards) {
          const n = typeof c === "string" ? c : c?.name;
          if (n) { names.push(n); allCardNames.add(n); }
        }
      }
      // 3. Preset custom cards
      for (const c of (preset.cards || [])) {
        const n = typeof c === "string" ? c : c?.name;
        if (n) { names.push(n); allCardNames.add(n); }
      }

      presetCardNamesMap.set(preset.id, [...new Set(names)]);
    }

    // Batch load card details in memory
    const batchCards = await getLocalCardsBatch(Array.from(allCardNames));

    for (const preset of presets) {
      const cardNames = presetCardNamesMap.get(preset.id) || [];
      let total = 0;
      for (const name of cardNames) {
        const cardMeta = batchCards[name];
        if (!cardMeta) continue;
        if (passesColorFilter(cardMeta.color_identity, selectedColors)) {
          const price = parseFloat(cardMeta.prices?.usd || cardMeta.prices?.usd_foil || 0) || 0;
          total += price;
        }
      }
      preset.price = `$${total.toFixed(2)}`;
    }
  } catch (err) {
    console.error("Error enriching presets with prices:", err);
    presets.forEach(p => { p.price = p.price || "$0.00"; });
  }

  return presets;
}

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// Helper to get user from token
function getUserId(req) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      return decoded.id;
    }
  } catch {}
  return null;
}

// Helper to parse preset data from database row
function parsePresetData(preset) {
  const landCycles = preset.landCycles ? JSON.parse(preset.landCycles) : {};
  const packages = preset.packages ? JSON.parse(preset.packages) : [];
  const cards = preset.cards ? JSON.parse(preset.cards) : [];
  const optionsCount = packages.length + Object.keys(landCycles).length + cards.length;
  return { landCycles, packages, cards, optionsCount };
}

// Helper to parse query param that can be string or array (from multiple query params)
function parseQueryArray(param) {
  if (Array.isArray(param)) {
    return param.filter(Boolean);
  }
  if (typeof param === 'string') {
    return param.split(',').filter(Boolean);
  }
  return [];
}

// Helper to serialize preset for API response
function serializePreset(preset, isUserPreset = false) {
  const { landCycles, packages, cards, optionsCount } = parsePresetData(preset);
  const base = {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    landCycles,
    packages,
    cards,
    optionsCount,
    isDefaultPreset: !isUserPreset,
    isUserPreset,
    createdAt: preset.created_at,
    updatedAt: preset.updated_at
  };
  if (isUserPreset) {
    base.userId = preset.user_id;
  }
  return base;
}

// GET all presets (default + user's)
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { packages = '', landcycles = '', colors = '' } = req.query;

    // Always seed default presets if needed
    await seedDefaultPresets();

    const selectedPackages = parseQueryArray(packages);
    const selectedLandcycles = parseQueryArray(landcycles);
    let selectedColors = parseQueryArray(colors);

    selectedColors = selectedColors.length === 0 ? ['colorless'] : selectedColors.filter(color => color !== 'colorless');

    // Start with default presets from database
    const defaultPresetsDb = await db("default_presets")
      .orderBy("created_at");

    let presets = defaultPresetsDb.map(preset => serializePreset(preset, false));

    // Add user presets if logged in
    if (userId) {
      const userPresets = await db("user_presets")
        .where({ user_id: userId })
        .orderBy("updated_at", "desc");

      const parsedUserPresets = userPresets.map(preset => serializePreset(preset, true));
      presets.push(...parsedUserPresets);
    }

    // Calculate prices in-memory if colors are provided and not colorless
    if (selectedColors.length > 0 && !selectedColors.includes('colorless')) {
      await enrichPresetsWithPrices(presets, selectedColors);
    }

    res.json(presets);
  } catch (error) {
    console.error('Error loading presets:', error);
    res.status(500).json({ error: 'Failed to load presets' });
  }
});

// POST create new user preset
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, description, packages, landCycles } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    // Check for duplicate name for this user
    const existing = await db("user_presets")
      .where({ user_id: req.user.id, name: name.trim() })
      .first();

    if (existing) {
      return res.status(400).json({ error: "Preset name already exists" });
    }

    const [preset] = await db("user_presets")
      .insert({
        user_id: req.user.id,
        name: name.trim(),
        description: description?.trim() || '',
        landCycles: JSON.stringify(landCycles || {}),
        packages: JSON.stringify(packages || []),
        cards: JSON.stringify(req.body.cards || [])
      })
      .returning("*");

    res.json(serializePreset(preset, true));
  } catch (error) {
    console.error('Error creating preset:', error);
    res.status(500).json({ error: 'Failed to create preset' });
  }
});

// GET specific preset by ID
router.get("/:id", async (req, res) => {
  try {
    const presetId = req.params.id;
    const userId = getUserId(req);

    // First try user presets if logged in
    if (userId) {
      const userPreset = await db("user_presets")
        .where({ id: presetId, user_id: userId })
        .first();

      if (userPreset) {
        return res.json(serializePreset(userPreset, true));
      }
    }

    // Then try default presets
    const defaultPreset = await db("default_presets")
      .where({ id: presetId })
      .first();

    if (defaultPreset) {
      return res.json(serializePreset(defaultPreset, false));
    }

    return res.status(404).json({ error: "Preset not found" });
  } catch (error) {
    console.error('Error getting preset:', error);
    res.status(500).json({ error: 'Failed to get preset' });
  }
});

// PUT update user preset
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const presetId = req.params.id;
    const { name, description, packages, landCycles } = req.body;

    const preset = await db("user_presets")
      .where({ id: presetId, user_id: req.user.id })
      .first();

    if (!preset) {
      return res.status(404).json({ error: "Preset not found" });
    }

    // Check for duplicate name if name is being changed
    if (name && name.trim() !== preset.name) {
      const existing = await db("user_presets")
        .where({ user_id: req.user.id, name: name.trim() })
        .whereNot({ id: presetId })
        .first();

      if (existing) {
        return res.status(400).json({ error: "Preset name already exists" });
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || '';
    if (packages !== undefined) updates.packages = JSON.stringify(packages || []);
    if (landCycles !== undefined) updates.landCycles = JSON.stringify(landCycles || {});
    if (req.body.cards !== undefined) updates.cards = JSON.stringify(req.body.cards || []);
    updates.updated_at = new Date();

    await db("user_presets")
      .where({ id: presetId })
      .update(updates);

    // Fetch updated preset
    const updatedPreset = await db("user_presets")
      .where({ id: presetId })
      .first();

    res.json(serializePreset(updatedPreset, true));
  } catch (error) {
    console.error('Error updating preset:', error);
    res.status(500).json({ error: 'Failed to update preset' });
  }
});

// POST apply preset (get details and log interaction)
router.post("/:id/apply", async (req, res) => {
  try {
    const presetId = req.params.id;
    const userId = getUserId(req);

    // Find the preset (try user first, then default)
    let preset = null;

    if (userId) {
      preset = await db("user_presets")
        .where({ id: presetId, user_id: userId })
        .first();
    }

    if (!preset) {
      preset = await db("default_presets")
        .where({ id: presetId })
        .first();
    }

    if (!preset) {
      return res.status(404).json({ error: "Preset not found" });
    }

    res.json(serializePreset(preset, !!preset.user_id));
  } catch (error) {
    console.error('Error applying preset:', error);
    res.status(500).json({ error: 'Failed to apply preset' });
  }
});

// DELETE user preset
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const presetId = req.params.id;

    const preset = await db("user_presets")
      .where({ id: presetId, user_id: req.user.id })
      .first();

    if (!preset) {
      return res.status(404).json({ error: "Preset not found" });
    }

    await db("user_presets").where({ id: presetId }).delete();
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting preset:', error);
    res.status(500).json({ error: 'Failed to delete preset' });
  }
});

export default router;
