// backend/middleware/auth.js
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function optionalAuth(req, _res, next) {
  let token = null;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    token = header.slice(7);
  } else if (req.query?.token) {
    token = req.query.token;
  } else if (req.body?.token) {
    token = req.body.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    const email = req.user.email;
    const isMainAdmin = email === "quantumaidan@gmail.com";
    const isDevAdmin = process.env.ENABLE_DEV_LOGIN === "true" && email === "dev@manabase.com";

    if (isMainAdmin || isDevAdmin) {
      next();
    } else {
      res.status(403).json({ error: "Admin access required" });
    }
  });
}
