// backend/routes/analytics.js
import express from "express";
import { optionalAuth, requireAdmin } from "../middleware/auth.js";
import {
  ingestEventBatch,
  getFeatureUsageStats,
  getFeatureUsers,
  FEATURE_TAXONOMY
} from "../services/analyticsService.js";

const router = express.Router();

/**
 * POST /api/analytics/batch
 * Ingest telemetry events from client browsers / beacons.
 * Uses optionalAuth: authenticated users have their user_id attached,
 * guests are recorded with is_guest = true.
 */
router.post("/batch", optionalAuth, async (req, res) => {
  try {
    let events = req.body;
    if (events && typeof events === "object" && Array.isArray(events.events)) {
      events = events.events;
    } else if (typeof events === "string") {
      try {
        const parsed = JSON.parse(events);
        events = Array.isArray(parsed) ? parsed : parsed.events || [];
      } catch {
        events = [];
      }
    }

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(200).json({ ok: true, count: 0 });
    }

    const result = await ingestEventBatch(events, req.user);
    res.status(200).json({ ok: true, count: result.count });
  } catch (error) {
    console.error("Analytics batch ingestion error:", error);
    res.status(500).json({ error: "Failed to ingest analytics batch" });
  }
});

/**
 * GET /api/analytics/taxonomy
 * Public metadata endpoint listing known features and categories.
 */
router.get("/taxonomy", (_req, res) => {
  res.json({ ok: true, taxonomy: FEATURE_TAXONOMY });
});

/**
 * GET /api/analytics/stats
 * Admin endpoint for feature usage stats, penetration rates, and prune candidates.
 */
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const stats = await getFeatureUsageStats(days);
    res.json({ ok: true, stats });
  } catch (error) {
    console.error("Analytics stats error:", error);
    res.status(500).json({ error: "Failed to fetch feature usage stats" });
  }
});

/**
 * GET /api/analytics/feature-users/:featureName
 * Admin endpoint for user drilldown on a specific feature.
 */
router.get("/feature-users/:featureName", requireAdmin, async (req, res) => {
  try {
    const { featureName } = req.params;
    const users = await getFeatureUsers(featureName);
    res.json({ ok: true, feature: featureName, users });
  } catch (error) {
    console.error("Analytics feature users drilldown error:", error);
    res.status(500).json({ error: "Failed to fetch feature users" });
  }
});

export default router;
