// backend/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { db } from "../db/connection.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// Helper to find existing user or create a new user via SSO
export async function findOrCreateSSOUser({ email, username, providerId, providerName, avatarUrl }) {
  const providerColumn = `${providerName}_id`; // google_id or discord_id

  // 1. Check if user exists by provider ID
  let user = await db("users").where({ [providerColumn]: providerId }).first();

  if (user) {
    if (avatarUrl && user.avatar_url !== avatarUrl) {
      await db("users").where({ id: user.id }).update({ avatar_url: avatarUrl });
      user.avatar_url = avatarUrl;
    }
    return user;
  }

  // 2. Check if user exists by email
  if (email) {
    user = await db("users").where({ email }).first();
    if (user) {
      const updateData = { [providerColumn]: providerId };
      if (avatarUrl) updateData.avatar_url = avatarUrl;
      await db("users").where({ id: user.id }).update(updateData);
      user[providerColumn] = providerId;
      if (avatarUrl) user.avatar_url = avatarUrl;
      return user;
    }
  }

  // 3. Create new user
  const userEmail = email || `${(username || "user").toLowerCase().replace(/[^a-z0-9]/g, "")}@${providerName}.user`;
  let baseUsername = username || (email ? email.split("@")[0] : `${providerName}User`);
  let finalUsername = baseUsername;

  let existingUserWithUsername = await db("users").where({ username: finalUsername }).first();
  let count = 1;
  while (existingUserWithUsername && count <= 10) {
    finalUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
    existingUserWithUsername = await db("users").where({ username: finalUsername }).first();
    count++;
  }

  const insertObj = {
    email: userEmail,
    username: finalUsername,
    password_hash: null,
    [providerColumn]: providerId,
    avatar_url: avatarUrl || null,
  };

  const inserted = await db("users").insert(insertObj).returning("id");
  const rawId = Array.isArray(inserted) ? inserted[0] : inserted;
  const newId = typeof rawId === "object" && rawId !== null ? (rawId.id || rawId) : rawId;
  user = await db("users").where({ id: newId }).first();
  return user;
}

// ------------------------------------
// Standard Register & Login
// ------------------------------------
router.post("/register", async (req, res) => {
  console.log("📩 Register body:", req.body);
  const { email, username, password } = req.body;
  if (!email || !username || !password)
    return res.status(400).json({ error: "Missing required fields" });

  const existing = await db("users").where({ email }).first();
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const hash = await bcrypt.hash(password, 10);
  const inserted = await db("users")
    .insert({ email, username, password_hash: hash })
    .returning(["id", "email", "username", "avatar_url"]);

  const rawId = Array.isArray(inserted) ? inserted[0] : inserted;
  const user = typeof rawId === "object" && rawId !== null && rawId.id
    ? rawId
    : await db("users").where({ email }).first();

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id: user.id, email: user.email, username: user.username, avatar_url: user.avatar_url || null } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db("users")
    .where({ email })
    .orWhere({ username: email })
    .first();
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  if (!user.password_hash) {
    return res.status(401).json({ error: "Account was created via SSO. Please sign in with Google or Discord." });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
  res.json({
    token,
    user: { id: user.id, email: user.email, username: user.username, avatar_url: user.avatar_url || null },
  });
});

// Dev auto-login (disabled in production)
router.post("/dev-login", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev login only allowed in development environment" });
  }

  try {
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
      user: { id: user.id, email: user.email, username: user.username, avatar_url: user.avatar_url || null },
    });
  } catch (err) {
    console.error("❌ Dev login error:", err);
    res.status(500).json({ error: "Dev login failed" });
  }
});

// ------------------------------------
// SSO Status Endpoint
// ------------------------------------
router.get("/providers", (req, res) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    discord: !!process.env.DISCORD_CLIENT_ID,
    devMode: process.env.NODE_ENV !== "production",
  });
});

// ------------------------------------
// Google SSO Routes
// ------------------------------------
router.get("/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    if (process.env.NODE_ENV !== "production") {
      // Dev mode fallback
      return res.redirect("/api/auth/google/dev-callback");
    }
    return res.status(400).json({ error: "Google OAuth is not configured." });
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
  const scope = encodeURIComponent("openid email profile");
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&prompt=select_account`;
  
  res.redirect(authUrl);
});

router.get("/google/dev-callback", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev callback only allowed in development mode" });
  }
  try {
    const user = await findOrCreateSSOUser({
      email: "google_dev@manabase.com",
      username: "GoogleUser",
      providerId: "google_dev_12345",
      providerName: "google",
      avatarUrl: "https://lh3.googleusercontent.com/a/default-user",
    });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.redirect(`/?sso_token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("❌ Google dev SSO error:", err);
    res.redirect(`/?sso_error=${encodeURIComponent("Google dev login failed")}`);
  }
});

router.get("/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect(`/?sso_error=${encodeURIComponent("Missing authorization code from Google")}`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Google token error:", tokenData);
      return res.redirect(`/?sso_error=${encodeURIComponent(tokenData.error_description || "Google authorization failed")}`);
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profile.sub) {
      return res.redirect(`/?sso_error=${encodeURIComponent("Failed to fetch Google profile")}`);
    }

    const user = await findOrCreateSSOUser({
      email: profile.email,
      username: profile.name || profile.given_name || (profile.email ? profile.email.split("@")[0] : "GoogleUser"),
      providerId: profile.sub,
      providerName: "google",
      avatarUrl: profile.picture || null,
    });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.redirect(`/?sso_token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("❌ Google callback error:", err);
    res.redirect(`/?sso_error=${encodeURIComponent("Google login failed")}`);
  }
});

router.post("/google", async (req, res) => {
  const { code, id_token, access_token } = req.body;
  
  if (process.env.NODE_ENV !== "production" && (!code && !id_token && !access_token)) {
    try {
      const user = await findOrCreateSSOUser({
        email: "google_dev@manabase.com",
        username: "GoogleUser",
        providerId: "google_dev_12345",
        providerName: "google",
        avatarUrl: "https://lh3.googleusercontent.com/a/default-user",
      });
      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({
        token,
        user: { id: user.id, email: user.email, username: user.username, avatar_url: user.avatar_url },
      });
    } catch (e) {
      return res.status(500).json({ error: "Dev Google login failed" });
    }
  }

  if (!code && !access_token) {
    return res.status(400).json({ error: "Missing authorization code or access token" });
  }

  try {
    let userAccessToken = access_token;
    if (code) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/google/callback`;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) return res.status(400).json({ error: tokenData.error_description || "Google authentication failed" });
      userAccessToken = tokenData.access_token;
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    const profile = await profileRes.json();

    if (!profile.sub) return res.status(400).json({ error: "Failed to retrieve Google profile" });

    const user = await findOrCreateSSOUser({
      email: profile.email,
      username: profile.name || profile.given_name || (profile.email ? profile.email.split("@")[0] : "GoogleUser"),
      providerId: profile.sub,
      providerName: "google",
      avatarUrl: profile.picture || null,
    });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, avatar_url: user.avatar_url || null },
    });
  } catch (err) {
    console.error("❌ Google POST auth error:", err);
    res.status(500).json({ error: "Google authentication failed" });
  }
});

// ------------------------------------
// Discord SSO Routes
// ------------------------------------
router.get("/discord", (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    if (process.env.NODE_ENV !== "production") {
      // Dev mode fallback
      return res.redirect("/api/auth/discord/dev-callback");
    }
    return res.status(400).json({ error: "Discord OAuth is not configured." });
  }

  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/discord/callback`;
  const scope = encodeURIComponent("identify email");
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
  
  res.redirect(authUrl);
});

router.get("/discord/dev-callback", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Dev callback only allowed in development mode" });
  }
  try {
    const user = await findOrCreateSSOUser({
      email: "discord_dev@manabase.com",
      username: "DiscordUser",
      providerId: "discord_dev_67890",
      providerName: "discord",
      avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
    });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.redirect(`/?sso_token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("❌ Discord dev SSO error:", err);
    res.redirect(`/?sso_error=${encodeURIComponent("Discord dev login failed")}`);
  }
});

router.get("/discord/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect(`/?sso_error=${encodeURIComponent("Missing authorization code from Discord")}`);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/discord/callback`;

  try {
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Discord token error:", tokenData);
      return res.redirect(`/?sso_error=${encodeURIComponent(tokenData.error_description || "Discord authorization failed")}`);
    }

    const profileRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profile.id) {
      return res.redirect(`/?sso_error=${encodeURIComponent("Failed to fetch Discord profile")}`);
    }

    const avatarUrl = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    const user = await findOrCreateSSOUser({
      email: profile.email,
      username: profile.global_name || profile.username || "DiscordUser",
      providerId: profile.id,
      providerName: "discord",
      avatarUrl,
    });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.redirect(`/?sso_token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("❌ Discord callback error:", err);
    res.redirect(`/?sso_error=${encodeURIComponent("Discord login failed")}`);
  }
});

router.post("/discord", async (req, res) => {
  const { code } = req.body;

  if (process.env.NODE_ENV !== "production" && !code) {
    try {
      const user = await findOrCreateSSOUser({
        email: "discord_dev@manabase.com",
        username: "DiscordUser",
        providerId: "discord_dev_67890",
        providerName: "discord",
        avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
      });
      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({
        token,
        user: { id: user.id, email: user.email, username: user.username, avatar_url: user.avatar_url },
      });
    } catch (e) {
      return res.status(500).json({ error: "Dev Discord login failed" });
    }
  }

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/discord/callback`;

    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(400).json({ error: tokenData.error_description || "Discord authentication failed" });
    }

    const profileRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profile.id) return res.status(400).json({ error: "Failed to retrieve Discord profile" });

    const avatarUrl = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    const user = await findOrCreateSSOUser({
      email: profile.email,
      username: profile.global_name || profile.username || "DiscordUser",
      providerId: profile.id,
      providerName: "discord",
      avatarUrl,
    });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, avatar_url: user.avatar_url || null },
    });
  } catch (err) {
    console.error("❌ Discord POST auth error:", err);
    res.status(500).json({ error: "Discord authentication failed" });
  }
});

export default router;
