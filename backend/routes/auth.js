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
  const user = await db("users").where({ email }).first();
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({
    token,
    user: { id: user.id, email: user.email, username: user.username },
  });
});

export default router;
