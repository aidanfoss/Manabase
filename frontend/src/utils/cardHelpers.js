// src/utils/cardHelpers.js

/**
 * Determines whether a card is a double-faced physical card (MDFC, Transform DFC, Reversible, etc.)
 * that requires a matching back face in printing (MPCfill XML).
 * Excludes single-sided cards with "//" in their name (e.g. Split cards, Adventure cards, Flip cards).
 */
export function isDoubleFacedCard(card) {
  if (!card) return false;
  if (card.isMDFC) return true;

  const layout = (card.layout || "").toLowerCase();

  // Known single-sided card layouts that have "//" in their name
  if (["split", "adventure", "flip"].includes(layout)) {
    return false;
  }

  // Known double-sided physical card layouts
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

  // Check card_faces array
  const faces = card.card_faces || card.faces || [];
  if (Array.isArray(faces) && faces.length > 1) {
    if (
      faces[0]?.image_uris ||
      faces[1]?.image_uris ||
      faces[0]?.image ||
      faces[1]?.image
    ) {
      return true;
    }
  }

  // Fallback check on card name: if it contains " // "
  const name = card.card_name || card.name || "";
  if (name.includes(" // ")) {
    return true;
  }

  return false;
}

/**
 * Returns the front face card name for a card.
 * For double-faced cards (e.g. "Lunarch Veteran // Luminous Phantom"),
 * returns "Lunarch Veteran".
 */
export function getCardFrontName(card) {
  if (!card) return "";
  const faces = card.card_faces || card.faces || [];
  if (isDoubleFacedCard(card) && faces[0]?.name) {
    return faces[0].name.trim();
  }
  const fullName = (card.card_name || card.name || "").trim();
  if (isDoubleFacedCard(card) && fullName.includes(" // ")) {
    return fullName.split("//")[0].trim();
  }
  return fullName;
}

/**
 * Returns the back face card name for a double-faced card.
 * For double-faced cards (e.g. "Lunarch Veteran // Luminous Phantom"),
 * returns "Luminous Phantom".
 */
export function getCardBackName(card) {
  if (!card) return "";
  const faces = card.card_faces || card.faces || [];
  if (isDoubleFacedCard(card) && faces[1]?.name) {
    return faces[1].name.trim();
  }
  const fullName = (card.card_name || card.name || "").trim();
  if (isDoubleFacedCard(card) && fullName.includes(" // ")) {
    return fullName.split("//")[1]?.trim() || "";
  }
  return "";
}
