import express from "express";
import multer from "multer";
import csvParser from "csv-parser";
import fs from "fs";
import { db } from "../db/connection.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ dest: "cache/uploads/" }); // Store temporarily

// POST /api/inventory/upload - Parse ManaBox CSV
router.post("/upload", authenticate, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const results = [];
  let headerIssue = false;

  fs.createReadStream(req.file.path)
    .pipe(csvParser())
    .on("headers", (headers) => {
      // Basic ManaBox check
      const required = ["Name", "Set code", "Collector number", "Foil"];
      const missing = required.filter(h => !headers.includes(h));
      if (missing.length > 0) {
        headerIssue = true;
      }
    })
    .on("data", (data) => {
      if (!headerIssue) results.push(data);
    })
    .on("end", async () => {
      fs.unlinkSync(req.file.path); // cleanup

      if (headerIssue) {
        return res.status(400).json({ error: "Invalid CSV format. Please use the default ManaBox export settings." });
      }

      try {
        await db.transaction(async (trx) => {
          for (const row of results) {
            const priceStr = row["Market Price"] || "0";
            const price = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
            const isFoil = row["Foil"] && row["Foil"].toLowerCase() !== "normal" && row["Foil"].trim() !== "";

            await trx("user_cards").insert({
              user_id: req.user.id,
              card_name: row["Name"],
              set_code: row["Set code"],
              collector_number: row["Collector number"],
              is_foil: isFoil,
              market_price: price || 0,
              max_price_threshold: null
            });
          }
        });

        res.json({ success: true, count: results.length });
      } catch (err) {
        console.error("CSV insert error:", err);
        res.status(500).json({ error: "Database error during import." });
      }
    })
    .on("error", (error) => {
      fs.unlinkSync(req.file.path);
      res.status(500).json({ error: "Failed to parse CSV." });
    });
});

// GET /api/inventory - List user's imported cards
router.get("/", authenticate, async (req, res) => {
  try {
    const cards = await db("user_cards")
      .where("user_id", req.user.id)
      .orderBy("card_name", "asc");
    res.json(cards);
  } catch (err) {
    console.error("Error fetching inventory:", err);
    res.status(500).json({ error: "Failed to fetch inventory." });
  }
});

export default router;
