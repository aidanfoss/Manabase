// backend/utils/cardHelpers.js

/**
 * Determines whether a card is a physical double-faced card (MDFC, Transform DFC, Reversible, etc.)
 * that requires a matching back face image.
 *
 * Single-faced cards with "//" in their name (Split cards like "Fire // Ice",
 * Adventure cards like "Brazen Borrower // Petty Theft", Flip cards like "Akki Lavarunner")
 * are physically printed on ONE face, so they return false.
 */
export function isDoubleFacedCard(cardMeta) {
  if (!cardMeta) return false;

  if (cardMeta.isMDFC || cardMeta.is_mdfc) return true;

  const layout = (cardMeta.layout || "").toLowerCase();

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

  // Check card_faces array if layout is missing but faces exist:
  const faces = cardMeta.card_faces || cardMeta.faces || [];
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
 * Returns normalized front and back names for a card.
 * Handles split DFCs ("Front // Back") only when the card is a true physical DFC.
 */
export function getCardFaces(cardName, meta) {
  if (!cardName) return { frontName: "", backName: null };
  if (isDoubleFacedCard(meta) && cardName.includes(" // ")) {
    const [front, back] = cardName.split(" // ");
    return { frontName: front.trim(), backName: back ? back.trim() : null };
  }
  return { frontName: cardName, backName: null };
}

