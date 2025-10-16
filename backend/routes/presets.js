// backend/routes/presets.js
import express from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { landCyclePresets } from "../data/landcyclesData.js";
import { readJsonSafe } from "../utils/safeJson.js";
import { fetchCardData } from "../services/scryfall.js";

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

// GET all presets (default + user's)
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { packages = '', landcycles = '', colors = '' } = req.query;

    // Always seed default presets if needed
    await seedDefaultPresets();

    const selectedPackages = packages.split(',').filter(Boolean);
    const selectedLandcycles = landcycles.split(',').filter(Boolean);
    const selectedColors = colors.split(',').filter(Boolean);

    // Start with default presets from database
    const defaultPresetsDb = await db("default_presets")
      .orderBy("created_at");

    let presets = defaultPresetsDb.map(preset => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      landCycles: preset.landCycles ? JSON.parse(preset.landCycles) : {},
      packages: preset.packages ? JSON.parse(preset.packages) : [],
      isDefaultPreset: true,
      createdAt: preset.created_at,
      updatedAt: preset.updated_at
    }));

    // Add user presets if logged in
    if (userId) {
      const userPresets = await db("user_presets")
        .where({ user_id: userId })
        .orderBy("updated_at", "desc");

      const parsedUserPresets = userPresets.map(preset => ({
        ...preset,
        id: preset.id,
        name: preset.name,
        description: preset.description,
        landCycles: preset.landCycles ? JSON.parse(preset.landCycles) : {},
        packages: preset.packages ? JSON.parse(preset.packages) : [],
        userId: preset.user_id,
        isUserPreset: true,
        createdAt: preset.created_at,
        updatedAt: preset.updated_at
      }));

      presets.push(...parsedUserPresets);
    }

    // Calculate prices for all presets
    const presetsWithPrices = await Promise.all(
      presets.map(async (preset) => {
        // Create query combining user's current selections with preset
        const presetQuery = {
          packages: selectedPackages,
          landcycles: Object.keys(preset.landCycles || {}),
          colors: selectedColors.length === 0 ? ['colorless'] : selectedColors
        };

        try {
          // Fetch actual cards that would be shown
          const cardsURL = new URL(`http://localhost:${process.env.PORT || 8080}/api/cards`);
          cardsURL.searchParams.append('packages', presetQuery.packages.join(','));
          presetQuery.landcycles.forEach(lc => cardsURL.searchParams.append('landcycles', lc));
          presetQuery.colors.forEach(c => cardsURL.searchParams.append('colors', c));

          const cardsResponse = await fetch(cardsURL.toString());
          if (!cardsResponse.ok) throw new Error();

          const cardsData = await cardsResponse.json();

          // Calculate total price
          let totalPrice = 0;
          if (Array.isArray(cardsData)) {
            cardsData.forEach(card => {
              const price = card.price || card.prices?.usd || 0;
              totalPrice += parseFloat(price) || 0;
            });
          } else if (cardsData?.lands) {
            cardsData.lands.forEach(card => {
              const price = card.price || card.prices?.usd || 0;
              totalPrice += parseFloat(price) || 0;
            });
          }

          return {
            ...preset,
            price: Math.round(totalPrice * 100) / 100
          };
        } catch (error) {
          return { ...preset, price: 0 };
        }
      })
    );

    res.json(presetsWithPrices);
  } catch (error) {
    console.error('Error loading presets:', error);
    res.status(500).json({ error: 'Failed to load presets' });
  }
});

// POST create new user preset
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, description, landCycles, packages } = req.body;

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
        packages: JSON.stringify(packages || [])
      })
      .returning("*");

    res.json({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      landCycles: preset.landCycles ? JSON.parse(preset.landCycles) : {},
      packages: preset.packages ? JSON.parse(preset.packages) : [],
      userId: preset.user_id,
      isUserPreset: true,
      createdAt: preset.created_at,
      updatedAt: preset.updated_at
    });
  } catch (error) {
    console.error('Error creating preset:', error);
    res.status(500).json({ error: 'Failed to create preset' });
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
