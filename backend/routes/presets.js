// backend/routes/presets.js
import express from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { landCyclePresets } from "../data/landcyclesData.js";

// Helper function to calculate preset price
async function calculatePresetPrice(preset, colors) {
  try {
    // Prepare query params for cards endpoint
    const params = new URLSearchParams();
    (Array.isArray(preset.packages) ? preset.packages : []).forEach(pkg => params.append('packages', pkg));
    Object.keys(preset.landCycles || {}).forEach(lc => params.append('landcycles', lc));
        colors.forEach(color => params.append('colors', color));

    // Fetch from internal cards API
    const response = await fetch(`http://localhost:${process.env.PORT || 8080}/api/cards?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    let totalPrice = 0;

    // Sum up prices from response
    if (Array.isArray(data)) {
      data.forEach(card => {
        const price = card.price || card.prices?.usd || "0";
        totalPrice += parseFloat(price) || 0;
      });
    } else if (data?.lands) {
      data.lands.forEach(card => {
        const price = card.price || card.prices?.usd || "0";
        totalPrice += parseFloat(price) || 0;
      });
    }

    return `$${totalPrice.toFixed(2)}`;
  } catch (error) {
    console.error('Error calculating preset price:', error);
    return "$0.00";
  }
}

// Seed default presets into database
async function seedDefaultPresets() {
  try {
    // Check if default presets are already seeded
    const existingCount = await db("default_presets").count("id as count");
    if (existingCount[0].count > 0) return; // Already seeded

    console.log("🌱 Seeding default presets...");

    // Insert all built-in presets as read-only defaults
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

    console.log("✅ Default presets seeded successfully");
  } catch (error) {
    console.error('Error seeding default presets:', error);
  }
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

    // Calculate prices if colors are provided and not colorless
    if (selectedColors.length > 0 && !selectedColors.includes('colorless')) {
      const pricePromises = presets.map(async (preset) => {
        try {
          return await calculatePresetPrice(preset, selectedColors);
        } catch (error) {
          console.error(`Error calculating price for preset ${preset.id}:`, error);
          return "$0.00";
        }
      });
      const prices = await Promise.all(pricePromises);
      presets.forEach((preset, index) => {
        preset.price = prices[index];
      });
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
