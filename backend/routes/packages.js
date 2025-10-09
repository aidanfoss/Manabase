// backend/routes/packages.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Create a new package
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

// List packages (own or public)
router.get("/", async (req, res) => {
  const { mine } = req.query;
  if (mine === "1") {
    const userId = req.headers.authorization
      ? jwt.verify(req.headers.authorization.split(" ")[1], process.env.JWT_SECRET || "dev_secret").id
      : null;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const pkgs = await db("packages").where({ user_id: userId });
    return res.json(pkgs);
  }
  const pkgs = await db("packages").where({ is_public: true });
  res.json(pkgs);
});

// Get by id
router.get("/:id", async (req, res) => {
  const pkg = await db("packages").where({ id: req.params.id }).first();
  if (!pkg) return res.status(404).json({ error: "Not found" });
  res.json(pkg);
});

// Update
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

// Delete
router.delete("/:id", requireAuth, async (req, res) => {
  const pkg = await db("packages").where({ id: req.params.id }).first();
  if (!pkg) return res.status(404).json({ error: "Not found" });
  if (pkg.user_id !== req.user.id)
    return res.status(403).json({ error: "Forbidden" });

  await db("packages").where({ id: req.params.id }).delete();
  res.json({ ok: true });
});

export default router;
