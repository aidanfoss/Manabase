// frontend/src/utils/parseCardLink.js

export function parseCardLink(input) {
  const text = input.trim();

  // --- Moxfield deck link ---
  if (text.includes("moxfield.com/decks/")) {
    const match = text.match(/moxfield\.com\/decks\/([\w-]+)/);
    if (match) return `moxfield:${match[1]}`;
  }

  // --- Scryfall single card link ---
  if (text.includes("scryfall.com/card/")) {
    const match = text.match(/scryfall\.com\/card\/[^/]+\/[^/]+\/([^?]+)/);
    if (match) return decodeURIComponent(match[1].replace(/-/g, " "));
  }

  // --- EDHREC card or commander link ---
  if (text.includes("edhrec.com/")) {
    const match = text.match(/edhrec\.com\/(?:cards|commanders)\/([^/?#]+)/);
    if (match) return decodeURIComponent(match[1].replace(/-/g, " "));
  }

  // --- Fallback: raw text ---
  if (text.length < 100 && !text.includes("http")) {
    return text; // maybe just a raw card name
  }

  return null;
}
