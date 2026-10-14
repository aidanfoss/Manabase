// frontend/src/utils/analytics.js
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

let eventQueue = [];
let flushTimeout = null;
const FLUSH_DELAY_MS = 3000;
const MAX_QUEUE_SIZE = 10;

export const ROUTE_FEATURE_MAP = {
  "/builder": "deckbuilder",
  "/decks": "decks_hub",
  "/updater": "deck_updater",
  "/presets": "land_presets",
  "/packages": "custom_packages",
  "/collection": "collection_manager",
  "/wishlist": "proxy_wishlist",
  "/alerts/wishlist-overlap": "wishlist_overlap",
  "/trade": "tradelist_manager",
  "/admin": "admin_dashboard"
};

export function getFeatureForPath(pathname) {
  if (!pathname) return null;
  // Exact match first
  if (ROUTE_FEATURE_MAP[pathname]) {
    return ROUTE_FEATURE_MAP[pathname];
  }
  // Prefix match
  for (const [route, feature] of Object.entries(ROUTE_FEATURE_MAP)) {
    if (pathname.startsWith(route)) {
      return feature;
    }
  }
  return null;
}

/**
 * Flush all buffered events to the backend.
 */
export async function flushAnalyticsQueue() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (eventQueue.length === 0) return;

  const eventsToSend = [...eventQueue];
  eventQueue = [];

  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;

  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    await fetch("/api/analytics/batch", {
      method: "POST",
      headers,
      body: JSON.stringify({ events: eventsToSend, token })
    });
  } catch (err) {
    // Re-queue events if network error occurs (up to limit)
    console.debug("[Analytics] Flush failed, restoring queue:", err.message);
    eventQueue = [...eventsToSend.slice(-20), ...eventQueue];
  }
}

/**
 * Flush events using navigator.sendBeacon during page exit / tab close.
 */
function flushBeacon() {
  if (eventQueue.length === 0) return;
  const eventsToSend = [...eventQueue];
  eventQueue = [];

  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const payload = JSON.stringify({ events: eventsToSend, token });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([payload], { type: "application/json" });
    const beaconUrl = token ? `/api/analytics/batch?token=${encodeURIComponent(token)}` : "/api/analytics/batch";
    navigator.sendBeacon(beaconUrl, blob);
  } else {
    // Fallback for environments without sendBeacon
    fetch("/api/analytics/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(() => {});
  }
}

/**
 * Track a feature usage action (debounced and batched).
 */
export function trackFeature(featureName, action = "view", metadata = null) {
  if (!featureName) return;

  eventQueue.push({
    feature_name: featureName,
    action,
    metadata,
    timestamp: new Date().toISOString()
  });

  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushAnalyticsQueue();
  } else {
    if (!flushTimeout) {
      flushTimeout = setTimeout(flushAnalyticsQueue, FLUSH_DELAY_MS);
    }
  }
}

/**
 * React hook to automatically log feature page views based on route navigation.
 */
export function useRouteAnalytics() {
  const location = useLocation();

  useEffect(() => {
    const feature = getFeatureForPath(location.pathname);
    if (feature) {
      trackFeature(feature, "view", { path: location.pathname });
    }
  }, [location.pathname]);
}

/**
 * Initialize listeners for unload / page hide events.
 */
export function initAnalytics() {
  if (typeof window === "undefined") return;

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushBeacon();
    }
  });

  window.addEventListener("pagehide", () => {
    flushBeacon();
  });

  window.addEventListener("beforeunload", () => {
    flushBeacon();
  });

  // Global window fallback for debugging
  window.manabaseAnalytics = {
    trackFeature,
    flush: flushAnalyticsQueue,
    trackEvent: (category, action, label) => {
      trackFeature(category, action, label ? { label } : null);
    },
    trackPageView: (path) => {
      const feature = getFeatureForPath(path);
      if (feature) {
        trackFeature(feature, "view", { path });
      }
    }
  };
}

// Backward compatibility helpers
export function trackEvent(category, action, label) {
  trackFeature(category, action, label ? { label } : null);
}

export function trackPageView(path) {
  const feature = getFeatureForPath(path);
  if (feature) {
    trackFeature(feature, "view", { path });
  }
}
