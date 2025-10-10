// backend/routes/packages.js
import express from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// 🧱 Create a new package
router.post("/", requireAuth, async (req, res) => {
  const { name, cards, is_public } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  const [pkg] = await db("packages")
    .insert({
      user_id: req.user.id,
      name,
      cards: JSON.stringify(cards || []),
      is_public: !!is_public,
    })
    .returning("*");

  res.json(pkg);
});

// GET all
router.get("/", async (req, res) => {
  try {
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
        userId = decoded.id;
      } catch {}
    }

    let packages;
    if (userId) {
      packages = await db("packages")
        .where({ user_id: userId })
        .orWhere({ is_public: true })
        .orderBy("updated_at", "desc");
    } else {
      packages = await db("packages")
        .where({ is_public: true })
        .orderBy("updated_at", "desc");
    }

    // ✅ Parse cards for every package
    const parsed = packages.map(parseCards);
    res.json(parsed);
  } catch (err) {
    console.error("❌ Error in GET /api/packages:", err);
    res.status(500).json({ error: "Failed to load packages." });
  }
});

// GET one by id
router.get("/:id", async (req, res) => {
  const pkg = await db("packages").where({ id: req.params.id }).first();
  if (!pkg) return res.status(404).json({ error: "Not found" });
  res.json(parseCards(pkg)); // ✅
});


// 🧱 Update package
router.put("/:id", requireAuth, async (req, res) => {
  const pkg = await db("packages").where({ id: req.params.id }).first();
  if (!pkg) return res.status(404).json({ error: "Not found" });
  if (pkg.user_id !== req.user.id)
    return res.status(403).json({ error: "Forbidden" });

  const { name, cards, is_public } = req.body;
  const updated = await db("packages")
    .where({ id: req.params.id })
    .update({
      name: name ?? pkg.name,
      cards: JSON.stringify(cards ?? pkg.cards),
      is_public: is_public ?? pkg.is_public,
      updated_at: db.fn.now(),
    })
    .returning("*");

  res.json(updated[0]);
});

// 🧱 Delete package
router.delete("/:id", requireAuth, async (req, res) => {
  const pkg = await db("packages").where({ id: req.params.id }).first();
  if (!pkg) return res.status(404).json({ error: "Not found" });
  if (pkg.user_id !== req.user.id)
    return res.status(403).json({ error: "Forbidden" });

  await db("packages").where({ id: req.params.id }).delete();
  res.json({ ok: true });
});

export default router;


function parseCards(pkg) {
  if (!pkg) return pkg;
  try {
    return {
      ...pkg,
      cards: typeof pkg.cards === "string" ? JSON.parse(pkg.cards) : pkg.cards,
    };
  } catch {
    return { ...pkg, cards: [] };
  }
}
