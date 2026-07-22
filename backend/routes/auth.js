// backend/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db/connection.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// Register
router.post("/register", async (req, res) => {
  console.log("📩 Register body:", req.body);
  const { email, username, password } = req.body;
  if (!email || !username || !password)
    return res.status(400).json({ error: "Missing required fields" });

  const existing = await db("users").where({ email }).first();
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const hash = await bcrypt.hash(password, 10);
  const [user] = await db("users")
    .insert({ email, username, password_hash: hash })
    .returning(["id", "email", "username"]);

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user });
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db("users")
    .where({ email })
    .orWhere({ username: email })
    .first();
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({
    token,
    user: { id: user.id, email: user.email, username: user.username },
  });
});

// Dev auto-login (disabled in production)
router.post("/dev-login", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev login only allowed in development environment" });
  }

  try {
    // AI NOTE: DevUser is the canonical primary user for testing and local dev. Do not change this to DevTest or anything else without explicit instruction.
    let user = await db("users")
      .where({ username: "DevUser" })
      .orWhere({ email: "dev@manabase.com" })
      .orWhere({ email: "devuser@example.com" })
      .first();

    if (!user) {
      const hash = await bcrypt.hash("devpassword", 4);
      const inserted = await db("users")
        .insert({ email: "dev@manabase.com", username: "DevUser", password_hash: hash })
        .returning("id");

      const rawId = Array.isArray(inserted) ? inserted[0] : inserted;
      const newId = typeof rawId === "object" && rawId !== null ? (rawId.id || rawId) : rawId;
      user = await db("users").where({ id: newId }).first();
    }

    if (!user) {
      return res.status(500).json({ error: "Failed to locate or create DevUser" });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    console.error("❌ Dev login error:", err);
    res.status(500).json({ error: "Dev login failed" });
  }
});

export default router;
