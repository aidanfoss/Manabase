// utils/pricing.js

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// return { amount, kind } from a Scryfall prices object (prefer usd, then usd_foil, then usd_etched on ties)
export function priceFromPrices(prices = {}) {
  const candidates = [
    ["usd", toNum(prices.usd)],
    ["usd_foil", toNum(prices.usd_foil)],
    ["usd_etched", toNum(prices.usd_etched)],
  ].filter(([, v]) => v != null);

  if (!candidates.length) return null;

  const rank = { usd: 0, usd_foil: 1, usd_etched: 2 };
  candidates.sort((a, b) => a[1] - b[1] || rank[a[0]] - rank[b[0]]);
  const [kind, amount] = candidates[0];
  return { amount, kind };
}

// Scan all prints and return the absolute cheapest with its printing
// -> { amount, kind, printing } or null
export function cheapestFromPrints(prints = []) {
  const rank = { usd: 0, usd_foil: 1, usd_etched: 2 };
  let best = null;

  for (const p of prints) {
    const pr = priceFromPrices(p?.prices || {});
    if (!pr) continue;
    if (
      !best ||
      pr.amount < best.amount ||
      (pr.amount === best.amount && rank[pr.kind] < rank[best.kind])
    ) {
      best = { ...pr, printing: p };
    }
  }
  return best;
}

// Convenience: choose the best possible price source (card.prices OR prints)
export function resolveDisplayPrice(card) {
  const top = priceFromPrices(card?.prices || {});
  if (top) return top;
  const viaPrints = cheapestFromPrints(card?.prints || []);
  return viaPrints ? { amount: viaPrints.amount, kind: viaPrints.kind } : null;
}
