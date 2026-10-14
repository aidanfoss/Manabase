// backend/services/analyticsService.js
import { db } from "../db/connection.js";
import crypto from "crypto";

export const FEATURE_TAXONOMY = {
  // Core Decks & Builder
  deckbuilder: { name: "Deckbuilder", category: "Core Decks & Builder" },
  decks_hub: { name: "Decks Hub", category: "Core Decks & Builder" },
  deck_updater: { name: "Deck Updater & Radar", category: "Core Decks & Builder" },
  land_presets: { name: "Land Presets", category: "Core Decks & Builder" },
  custom_packages: { name: "Custom Packages", category: "Core Decks & Builder" },

  // Proxy & Ordering
  proxy_wishlist: { name: "Proxy Wishlist", category: "Proxy & Ordering" },
  proxy_art_mpcfill: { name: "MPCfill Art Selection", category: "Proxy & Ordering" },
  proxy_orders: { name: "Proxy Orders", category: "Proxy & Ordering" },

  // Collection & Trade
  collection_manager: { name: "Collection Manager", category: "Collection & Trade" },
  tradelist_manager: { name: "Tradelist Manager", category: "Collection & Trade" },
  trade_proposals: { name: "Trade Proposals", category: "Collection & Trade" },
  wishlist_overlap: { name: "Wishlist Overlap / Matches", category: "Collection & Trade" },

  // External Sync
  moxfield_sync: { name: "Moxfield Sync", category: "External Sync" },
  archidekt_sync: { name: "Archidekt Sync", category: "External Sync" },

  // Playgroups & Social
  playgroup_nexus: { name: "Playgroup Nexus", category: "Playgroups & Social" },

  // Admin & Settings
  admin_dashboard: { name: "Admin Dashboard", category: "Administration" }
};

const IDENTIFIER_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

function getYearMonth(date = new Date()) {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Record a single feature usage event directly from backend code or workers.
 */
export async function recordFeatureUsage(userId, featureName, action, metadata = null) {
  if (!IDENTIFIER_REGEX.test(featureName) || !IDENTIFIER_REGEX.test(action)) {
    return false;
  }

  const isGuest = !userId;
  const yearMonth = getYearMonth();
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");

  try {
    // 1. Raw event log
    await db("analytics_events").insert({
      id,
      user_id: userId || null,
      is_guest: isGuest,
      feature_name: featureName,
      action,
      metadata: metadata ? JSON.stringify(metadata) : null,
      created_at: db.fn.now()
    });

    // 2. Permanent monthly ledger upsert
    if (userId) {
      const existing = await db("user_feature_monthly")
        .where({ user_id: userId, feature_name: featureName, year_month: yearMonth })
        .first();

      if (existing) {
        await db("user_feature_monthly")
          .where({ id: existing.id })
          .increment("usage_count", 1)
          .update({ last_used_at: db.fn.now() });
      } else {
        await db("user_feature_monthly").insert({
          user_id: userId,
          is_guest: false,
          feature_name: featureName,
          year_month: yearMonth,
          usage_count: 1,
          first_used_at: db.fn.now(),
          last_used_at: db.fn.now()
        });
      }
    } else {
      const existingGuest = await db("user_feature_monthly")
        .where({ feature_name: featureName, year_month: yearMonth })
        .whereNull("user_id")
        .first();

      if (existingGuest) {
        await db("user_feature_monthly")
          .where({ id: existingGuest.id })
          .increment("usage_count", 1)
          .update({ last_used_at: db.fn.now() });
      } else {
        await db("user_feature_monthly").insert({
          user_id: null,
          is_guest: true,
          feature_name: featureName,
          year_month: yearMonth,
          usage_count: 1,
          first_used_at: db.fn.now(),
          last_used_at: db.fn.now()
        });
      }
    }

    return true;
  } catch (err) {
    console.error("recordFeatureUsage error:", err.message);
    return false;
  }
}

/**
 * Ingest a batch of events emitted from client browser or beacon.
 */
export async function ingestEventBatch(events, user = null) {
  if (!Array.isArray(events) || events.length === 0) {
    return { success: true, count: 0 };
  }

  // Cap batch size
  const batch = events.slice(0, 50);
  const userId = user?.id || null;
  const isGuest = !userId;
  let processed = 0;

  for (const ev of batch) {
    const featureName = String(ev.feature_name || "").trim();
    const action = String(ev.action || "view").trim();

    if (!IDENTIFIER_REGEX.test(featureName) || !IDENTIFIER_REGEX.test(action)) {
      continue;
    }

    let metadataStr = null;
    if (ev.metadata && typeof ev.metadata === "object") {
      try {
        const str = JSON.stringify(ev.metadata);
        if (str.length <= 2048) {
          metadataStr = str;
        }
      } catch {
        // ignore invalid metadata
      }
    }

    const eventTime = ev.timestamp ? new Date(ev.timestamp) : new Date();
    const yearMonth = getYearMonth(eventTime);
    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");

    try {
      await db("analytics_events").insert({
        id,
        user_id: userId,
        is_guest: isGuest,
        feature_name: featureName,
        action,
        metadata: metadataStr,
        created_at: eventTime.toISOString()
      });

      if (userId) {
        const existing = await db("user_feature_monthly")
          .where({ user_id: userId, feature_name: featureName, year_month: yearMonth })
          .first();

        if (existing) {
          await db("user_feature_monthly")
            .where({ id: existing.id })
            .increment("usage_count", 1)
            .update({ last_used_at: db.fn.now() });
        } else {
          await db("user_feature_monthly").insert({
            user_id: userId,
            is_guest: false,
            feature_name: featureName,
            year_month: yearMonth,
            usage_count: 1,
            first_used_at: db.fn.now(),
            last_used_at: db.fn.now()
          });
        }
      } else {
        const existingGuest = await db("user_feature_monthly")
          .where({ feature_name: featureName, year_month: yearMonth })
          .whereNull("user_id")
          .first();

        if (existingGuest) {
          await db("user_feature_monthly")
            .where({ id: existingGuest.id })
            .increment("usage_count", 1)
            .update({ last_used_at: db.fn.now() });
        } else {
          await db("user_feature_monthly").insert({
            user_id: null,
            is_guest: true,
            feature_name: featureName,
            year_month: yearMonth,
            usage_count: 1,
            first_used_at: db.fn.now(),
            last_used_at: db.fn.now()
          });
        }
      }

      processed++;
    } catch (e) {
      console.warn("Failed to insert analytics event in batch:", e.message);
    }
  }

  return { success: true, count: processed };
}

/**
 * Get aggregated feature usage stats for the Admin Dashboard.
 */
export async function getFeatureUsageStats(days = 30) {
  const windowDays = Number(days) || 30;

  // 1. Total registered users
  const totalUsersRow = await db("users").count("id as count").first();
  const totalUsers = totalUsersRow?.count || 0;

  // 2. Active users in period (users who performed any action)
  const activeUsersRow = await db("analytics_events")
    .where("created_at", ">=", db.raw(`datetime('now', '-${windowDays} days')`))
    .whereNotNull("user_id")
    .countDistinct("user_id as count")
    .first();
  const activeUsers = activeUsersRow?.count || 0;

  // 3. Aggregate events in the window by feature
  const windowStats = await db("analytics_events")
    .where("created_at", ">=", db.raw(`datetime('now', '-${windowDays} days')`))
    .select("feature_name")
    .count("id as total_uses")
    .countDistinct("user_id as distinct_users")
    .select(db.raw("SUM(CASE WHEN is_guest = 1 OR user_id IS NULL THEN 1 ELSE 0 END) as guest_uses"))
    .max("created_at as last_used_at")
    .groupBy("feature_name");

  const statsMap = new Map();
  for (const row of windowStats) {
    statsMap.set(row.feature_name, {
      total_uses: Number(row.total_uses) || 0,
      distinct_users: Number(row.distinct_users) || 0,
      guest_uses: Number(row.guest_uses) || 0,
      last_used_at: row.last_used_at || null
    });
  }

  // 4. Also check user_feature_monthly for features that had historical activity
  const allKnownFeatures = new Set([
    ...Object.keys(FEATURE_TAXONOMY),
    ...statsMap.keys()
  ]);

  const featureStats = [];
  const pruneCandidates = [];

  for (const featureKey of allKnownFeatures) {
    const meta = FEATURE_TAXONOMY[featureKey] || {
      name: featureKey.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      category: "Uncategorized"
    };

    const cur = statsMap.get(featureKey) || {
      total_uses: 0,
      distinct_users: 0,
      guest_uses: 0,
      last_used_at: null
    };

    // If last_used_at wasn't in window, fetch latest from all-time user_feature_monthly
    let lastUsedAt = cur.last_used_at;
    if (!lastUsedAt) {
      const historical = await db("user_feature_monthly")
        .where("feature_name", featureKey)
        .max("last_used_at as last_used_at")
        .first();
      lastUsedAt = historical?.last_used_at || null;
    }

    // Penetration % relative to active users (or total registered users if active is low)
    const baseDenominator = Math.max(activeUsers, totalUsers, 1);
    const penetrationRate = cur.distinct_users / baseDenominator;
    const penetrationPct = Math.round(penetrationRate * 100);

    // Prune candidate criteria:
    // 0 distinct users in window, or penetration < 5% with low usage
    const isPruneCandidate = cur.distinct_users === 0 || (penetrationRate < 0.05 && cur.total_uses < 15);

    const item = {
      feature_key: featureKey,
      name: meta.name,
      category: meta.category,
      total_uses: cur.total_uses,
      distinct_users: cur.distinct_users,
      guest_uses: cur.guest_uses,
      penetration_pct: penetrationPct,
      last_used_at: lastUsedAt,
      is_prune_candidate: isPruneCandidate
    };

    featureStats.push(item);
    if (isPruneCandidate) {
      pruneCandidates.push(item);
    }
  }

  // Sort feature stats: most active to least active
  featureStats.sort((a, b) => b.total_uses - a.total_uses || b.distinct_users - a.distinct_users);

  // Sort prune candidates: lowest uses first
  pruneCandidates.sort((a, b) => a.total_uses - b.total_uses || (a.last_used_at ? 1 : -1));

  return {
    period_days: windowDays,
    total_users: totalUsers,
    active_users: activeUsers,
    prune_candidates_count: pruneCandidates.length,
    prune_candidates: pruneCandidates,
    feature_stats: featureStats
  };
}

/**
 * Get distinct users who have used a specific feature (for the drilldown modal).
 */
export async function getFeatureUsers(featureName) {
  if (!IDENTIFIER_REGEX.test(featureName)) {
    return [];
  }

  const rows = await db("user_feature_monthly")
    .join("users", "users.id", "user_feature_monthly.user_id")
    .where("user_feature_monthly.feature_name", featureName)
    .select(
      "users.id",
      "users.username",
      "users.email",
      "users.avatar_url",
      db.raw("SUM(user_feature_monthly.usage_count) as total_uses"),
      db.raw("MIN(user_feature_monthly.first_used_at) as first_used_at"),
      db.raw("MAX(user_feature_monthly.last_used_at) as last_used_at")
    )
    .groupBy("users.id", "users.username", "users.email", "users.avatar_url")
    .orderBy("total_uses", "desc");

  return rows.map(r => ({
    id: r.id,
    username: r.username,
    email: r.email,
    avatar_url: r.avatar_url,
    total_uses: Number(r.total_uses) || 0,
    first_used_at: r.first_used_at,
    last_used_at: r.last_used_at
  }));
}
