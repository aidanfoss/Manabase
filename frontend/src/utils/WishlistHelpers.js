
// Helper to generate descriptive tag for a card print variant (e.g. #290 Borderless)
export const getPrintVariantLabel = (p) => {
  const parts = [];
  if (p.collector_number) parts.push(`#${p.collector_number}`);
  if (p.border_color === "borderless") parts.push("Borderless");
  if (p.frame_effects?.includes("showcase")) parts.push("Showcase");
  if (p.frame_effects?.includes("extendedart")) parts.push("Extended Art");
  if (p.promo_types?.includes("prerelease")) parts.push("Prerelease");
  if (p.promo_types?.includes("stamped")) parts.push("Stamped");
  if (p.full_art && !parts.includes("Borderless")) parts.push("Full Art");
  return parts.join(" ");
};

// Helper to extract deduplicated unique sets from prints list
export const getUniqueSetsFromPrints = (prints = []) => {
  const seen = new Set();
  const uniqueSets = [];
  for (const p of prints) {
    const setCode = (p.set || "").toUpperCase();
    if (!setCode || seen.has(setCode)) continue;
    seen.add(setCode);
    uniqueSets.push({
      set_code: setCode,
      set_name: p.set_name || setCode
    });
  }
  return uniqueSets;
};

// Helper to build Finish / Version dropdown options for a given card and set_code
export const getFinishVersionOptions = (cachedPrints, setCode) => {
  if (!cachedPrints || !cachedPrints.prints || cachedPrints.prints.length === 0) {
    return [
      { key: ":normal", collNum: "", isFoil: false, label: "Normal" },
      { key: ":foil", collNum: "", isFoil: true, label: "Foil" }
    ];
  }

  const matchingPrints = cachedPrints.prints.filter(p => p.set?.toUpperCase() === (setCode || "").toUpperCase());
  const targetPrints = matchingPrints.length > 0 ? matchingPrints : cachedPrints.prints;
  const isMultiVariant = targetPrints.length > 1;

  const options = [];
  targetPrints.forEach((p) => {
    const variantTag = getPrintVariantLabel(p);
    const tagSuffix = variantTag ? ` (${variantTag})` : isMultiVariant ? ` (#${p.collector_number})` : "";

    const normPrice = p.prices?.usd ? ` ($${parseFloat(p.prices.usd).toFixed(2)})` : "";
    const foilPrice = p.prices?.usd_foil ? ` ($${parseFloat(p.prices.usd_foil).toFixed(2)})` : "";

    options.push({
      key: `${p.collector_number || ""}:normal`,
      collNum: p.collector_number || "",
      isFoil: false,
      label: `Normal${tagSuffix}${normPrice}`
    });

    options.push({
      key: `${p.collector_number || ""}:foil`,
      collNum: p.collector_number || "",
      isFoil: true,
      label: `Foil${tagSuffix}${foilPrice}`
    });
  });

  return options;
};

// Helper to get high-res image URL
export const getCardImageUrl = (card, cardMeta) => {
  if (!card) return null;
  const prints = cardMeta?.prints || [];
  const setPrints = card.set_code ? prints.filter(p => p.set?.toUpperCase() === card.set_code.toUpperCase()) : prints;
  const activePrint = setPrints.length > 0
    ? (setPrints.find(p => card.collector_number ? p.collector_number === card.collector_number : true) || setPrints[0])
    : (prints[0] || cardMeta);

  if (activePrint) {
    return activePrint.image_uris?.normal || activePrint.image_uris?.small || activePrint.card_faces?.[0]?.image_uris?.normal || cardMeta?.image_uris?.normal;
  }
  return cardMeta?.image_uris?.normal || cardMeta?.image_uris?.small || null;
};

export function generateManaPoolCheckoutUrl(items) {
  if (!items || items.length === 0) return "https://manapool.com/add-deck";

  const deckLines = items.map(item => {
    const qty = typeof item === "object" ? (item.quantity || item.qty || item.count || 1) : 1;
    const name = typeof item === "string" ? item : (item.card_name || item.name || item.title || "");
    const set = typeof item === "object" ? (item.set_code || item.setCode || item.set || "") : "";
    const collector = typeof item === "object" ? (item.collector_number || item.collector || "") : "";
    if (set && collector) {
      return `${qty} ${name} [${set.toLowerCase()}] ${collector}`;
    }
    return `${qty} ${name}`;
  }).filter(line => line.trim().length > 0);

  const deckText = deckLines.join("\n");
  const base64Deck = typeof btoa !== "undefined"
    ? btoa(unescape(encodeURIComponent(deckText)))
    : Buffer.from(deckText).toString("base64");

  return `https://manapool.com/add-deck?ref=scm&tap_s=5258590-8677e0&deck=${encodeURIComponent(base64Deck)}&ref_meta=referrer:manabase-bulkBuy`;
}
