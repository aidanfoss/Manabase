// frontend/src/utils/analytics.js

export function initAnalytics() {
  // Initialize analytics or telemetry tracking
  if (typeof window !== 'undefined') {
    window.manabaseAnalytics = {
      trackEvent: (category, action, label) => {
        console.debug(`[Analytics] ${category} / ${action} / ${label || ''}`);
        // Can be extended to connect with Plausible, GA4, or custom backend endpoint
        const events = JSON.parse(localStorage.getItem('manabase_events') || '[]');
        events.push({ category, action, label, timestamp: new Date().toISOString() });
        if (events.length > 100) events.shift();
        localStorage.setItem('manabase_events', JSON.stringify(events));
      },
      trackPageView: (path) => {
        console.debug(`[Analytics] PageView: ${path}`);
      }
    };
  }
}

export function trackEvent(category, action, label) {
  if (window.manabaseAnalytics) {
    window.manabaseAnalytics.trackEvent(category, action, label);
  }
}

export function trackPageView(path) {
  if (window.manabaseAnalytics) {
    window.manabaseAnalytics.trackPageView(path);
  }
}
