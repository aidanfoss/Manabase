// backend/routes/cardbacks.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readJsonSafe } from "../utils/safeJson.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cardbacksFilePath = path.resolve(__dirname, "../data/cardbacks.json");

const router = express.Router();

// Fallback cardbacks list in case file is missing/corrupted
const defaultCardbacks = [
  {
    id: "standard_mtg",
    name: "Standard Magic Back",
    author: "Official",
    dpi: "800 DPI",
    query: "c:mtgcardback",
    driveId: "",
    previewUrl: "https://cards.scryfall.io/card_back.png"
  },
  {
    id: "black_lotus",
    name: "Black Lotus",
    author: "Chilli_Axe Cardbacks",
    dpi: "800 DPI",
    query: "b:black lotus",
    driveId: "1LrVX0pUcye9n_0RtaDNVl2xPrQgn7CYf",
    previewUrl: "https://cards.scryfall.io/art_crop/front/b/0/b0fa7ce3-77f0-46b0-ae54-20fcd4c32147.jpg"
  },
  {
    id: "berserk",
    name: "Berserk",
    author: "Chilli_Axe Cardbacks",
    dpi: "800 DPI",
    query: "b:berserk",
    driveId: "1xTnSx8FhtZX1IV_OXUeorFaJS8iYwV45",
    previewUrl: "https://cards.scryfall.io/art_crop/front/8/6/86725350-0196-419b-a010-8b6b6b7a544a.jpg"
  },
  {
    id: "commence_the_endgame",
    name: "Commence the Endgame",
    author: "Chilli_Axe Cardbacks",
    dpi: "800 DPI",
    query: "b:commence endgame",
    driveId: "1k2Ko1GuZc15Kl7gXsGp2wlt71TD86wUJ",
    previewUrl: "https://cards.scryfall.io/art_crop/front/2/0/209d70a2-c8c1-4072-ab90-785ed4c8b0b8.jpg"
  },
  {
    id: "proxy_card_back_2",
    name: "Proxy Card Back 2",
    author: "CompC Cardbacks",
    dpi: "810 DPI",
    query: "b:proxy card back",
    driveId: "1Lhx7lKQ1LG47uePUpEneZGeHdH6YvQio",
    previewUrl: "https://cards.scryfall.io/card_back.png"
  }
];

// Helper to get cardbacks array
function getCardbacks() {
  if (fs.existsSync(cardbacksFilePath)) {
    const data = readJsonSafe(cardbacksFilePath);
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  }
  return defaultCardbacks;
}

// GET /api/cardbacks - Fetch all prebuilt cardbacks
router.get("/", (_req, res) => {
  try {
    const list = getCardbacks();
    res.json(list);
  } catch (err) {
    console.error("❌ Error loading cardbacks:", err);
    res.status(500).json({ error: "Failed to load cardbacks list" });
  }
});

// POST /api/cardbacks - Add a new prebuilt cardback
router.post("/", (req, res) => {
  try {
    const { name, author, dpi, query, driveId, previewUrl } = req.body;
    if (!name || (!query && !driveId)) {
      return res.status(400).json({ error: "Name and either query or driveId are required." });
    }

    const current = getCardbacks();
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const newItem = {
      id,
      name,
      author: author || "Custom",
      dpi: dpi || "800 DPI",
      query: query || "",
      driveId: driveId || "",
      previewUrl: previewUrl || ""
    };

    const existingIndex = current.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      current[existingIndex] = newItem;
    } else {
      current.push(newItem);
    }

    const dataDir = path.dirname(cardbacksFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(cardbacksFilePath, JSON.stringify(current, null, 2), "utf8");
    res.json({ success: true, cardback: newItem, total: current.length });
  } catch (err) {
    console.error("❌ Error adding cardback:", err);
    res.status(500).json({ error: "Failed to save cardback" });
  }
});

export default router;
