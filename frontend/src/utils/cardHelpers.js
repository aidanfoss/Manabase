// src/utils/cardHelpers.js

/**
 * Determines whether a card is a physical double-faced card (MDFC, Transform DFC, Reversible, etc.)
 * that requires a matching back face image in printing (MPCfill XML).
 *
 * Single-faced cards with "//" in their name (Split cards like "Fire // Ice",
 * Adventure cards like "Brazen Borrower // Petty Theft", Flip cards like "Akki Lavarunner")
 * are physically printed on ONE face, so they return false.
 */
export function isDoubleFacedCard(card, meta) {
  if (!card && !meta) return false;
  const merged = { ...meta, ...card };

  if (merged.isMDFC || merged.is_mdfc) return true;

  const layout = (merged.layout || card?.layout || meta?.layout || "").toLowerCase();

  // Known single-faced layouts that use "//" in their name
  if (
    [
      "split",
      "adventure",
      "flip",
      "normal",
      "leveler",
      "class",
      "saga",
      "planar",
      "scheme",
      "vanguard",
      "token",
      "emblem",
      "augment",
      "host"
    ].includes(layout)
  ) {
    return false;
  }

  // Known physical double-faced card layouts
  if (
    [
      "modal_dfc",
      "transform",
      "double_faced",
      "double_sided",
      "reversible_card",
      "art_series",
      "meld"
    ].includes(layout)
  ) {
    return true;
  }

  // Check card_faces array:
  // In Scryfall API data, double-faced cards have distinct image_uris on BOTH faces.
  // Single-faced split/adventure/flip cards have image_uris on the top-level card object, NOT on individual card_faces.
  const faces = merged.card_faces || card?.card_faces || meta?.card_faces || merged.faces || [];
  if (Array.isArray(faces) && faces.length > 1) {
    const face0HasImages = !!(faces[0]?.image_uris || faces[0]?.image);
    const face1HasImages = !!(faces[1]?.image_uris || faces[1]?.image);
    if (face0HasImages && face1HasImages) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the front face card name for a card.
 * For physical double-faced cards (e.g. "Lunarch Veteran // Luminous Phantom"),
 * returns "Lunarch Veteran".
 * For single-sided cards (including split cards like "Fire // Ice" or "Sol Ring"),
 * returns the full card name ("Fire // Ice").
 */
export function getCardFrontName(card, meta) {
  if (!card && !meta) return "";
  const merged = { ...meta, ...card };
  const isDfc = isDoubleFacedCard(card, meta);

  if (isDfc) {
    const faces = merged.card_faces || card?.card_faces || meta?.card_faces || merged.faces || [];
    if (faces[0]?.name) {
      return faces[0].name.trim();
    }
    const fullName = (merged.card_name || merged.name || "").trim();
    if (fullName.includes(" // ")) {
      return fullName.split("//")[0].trim();
    }
    return fullName;
  }

  return (merged.card_name || merged.name || "").trim();
}

/**
 * Returns the back face card name for a physical double-faced card.
 * For double-faced cards (e.g. "Lunarch Veteran // Luminous Phantom"),
 * returns "Luminous Phantom".
 * For single-sided cards (including "Fire // Ice"), returns "".
 */
export function getCardBackName(card, meta) {
  if (!card && !meta) return "";
  const merged = { ...meta, ...card };
  const isDfc = isDoubleFacedCard(card, meta);

  if (!isDfc) return "";

  const faces = merged.card_faces || card?.card_faces || meta?.card_faces || merged.faces || [];
  if (faces[1]?.name) {
    return faces[1].name.trim();
  }
  const fullName = (merged.card_name || merged.name || "").trim();
  if (fullName.includes(" // ")) {
    return fullName.split("//")[1]?.trim() || "";
  }
  return "";
}

/**
 * Formats a list of card objects into the MPCfill text list format:
 *
 * 2x Evercoat Ursine
 * 2x Faerie Duelist
 * 1x Tanglepool Bridge
 * 3x Forest
 *
 * 2x t:Thopter
 *
 * 1x b:Simic Card Back
 */
export function formatMpcTextList(flatQueue, printsCache = {}, defaultCardBack = "") {
  if (!flatQueue || flatQueue.length === 0) return "";

  const cardCounts = new Map();
  const tokenCounts = new Map();
  const backCounts = new Map();

  flatQueue.forEach((c) => {
    const rawName = c.card_name || c.name || "Unknown Card";
    const meta = printsCache[rawName];
    const isDfc = isDoubleFacedCard(c, meta);
    const typeLine = (c.type_line || meta?.type_line || "").toLowerCase();
    const isToken = typeLine.includes("token");

    if (isToken) {
      tokenCounts.set(rawName, (tokenCounts.get(rawName) || 0) + 1);
    } else {
      const displayFrontName = isDfc ? getCardFrontName(c, meta) : rawName;
      cardCounts.set(displayFrontName, (cardCounts.get(displayFrontName) || 0) + 1);
    }

    if (!isDfc) {
      const userBack = (c.user_card_back || defaultCardBack || "").trim();
      if (userBack && userBack !== "b:black lotus" && userBack !== "default") {
        const backName = userBack.startsWith("b:") ? userBack.slice(2) : userBack;
        backCounts.set(backName, (backCounts.get(backName) || 0) + 1);
      }
    }
  });

  const sections = [];

  // Main cards
  if (cardCounts.size > 0) {
    const mainLines = [];
    for (const [name, count] of cardCounts.entries()) {
      mainLines.push(`${count}x ${name}`);
    }
    sections.push(mainLines.join("\n"));
  }

  // Tokens
  if (tokenCounts.size > 0) {
    const tokenLines = [];
    for (const [name, count] of tokenCounts.entries()) {
      tokenLines.push(`${count}x t:${name}`);
    }
    sections.push(tokenLines.join("\n"));
  }

  // Card backs
  if (backCounts.size > 0) {
    const backLines = [];
    for (const [name, count] of backCounts.entries()) {
      backLines.push(`${count}x b:${name}`);
    }
    sections.push(backLines.join("\n"));
  }

  return sections.join("\n\n");
}
