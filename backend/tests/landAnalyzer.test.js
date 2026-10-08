import { describe, it, expect } from "vitest";
import { analyzeLands, isLandColorCompatible, getLandRequiredColors } from "../services/landAnalyzer.js";

describe("landAnalyzer - Color Compatibility", () => {
  it("should match on-color fetchlands and reject off-color fetchlands", () => {
    // Gruul deck (Red / Green)
    const gruulColors = ["R", "G"];

    // Wooded Foothills (Mountain/Forest) -> R, G (Compatible)
    expect(isLandColorCompatible("Wooded Foothills", null, gruulColors)).toBe(true);

    // Arid Mesa (Mountain/Plains) -> R, W (Incompatible: White is not in Gruul)
    expect(isLandColorCompatible("Arid Mesa", null, gruulColors)).toBe(false);

    // Flooded Strand (Plains/Island) -> W, U (Incompatible)
    expect(isLandColorCompatible("Flooded Strand", null, gruulColors)).toBe(false);

    // Bloodstained Mire (Swamp/Mountain) -> B, R (Incompatible: Black is not in Gruul)
    expect(isLandColorCompatible("Bloodstained Mire", null, gruulColors)).toBe(false);
  });

  it("should match dual lands strictly within deck color identity", () => {
    const gruulColors = ["R", "G"];

    // Stomping Ground (R, G)
    expect(isLandColorCompatible("Stomping Ground", { color_identity: ["R", "G"] }, gruulColors)).toBe(true);

    // Badlands (B, R) -> Incompatible
    expect(isLandColorCompatible("Badlands", { color_identity: ["B", "R"] }, gruulColors)).toBe(false);

    // Bayou (B, G) -> Incompatible
    expect(isLandColorCompatible("Bayou", { color_identity: ["B", "G"] }, gruulColors)).toBe(false);

    // Watery Grave (U, B) -> Incompatible
    expect(isLandColorCompatible("Watery Grave", { color_identity: ["U", "B"] }, gruulColors)).toBe(false);
  });

  it("should reject 3-color Triomes/Landscapes in a 2-color deck", () => {
    const gruulColors = ["R", "G"];

    // Ziatora's Proving Ground (B, R, G) -> Incompatible in 2-color Gruul
    expect(isLandColorCompatible("Ziatora's Proving Ground", null, gruulColors)).toBe(false);

    // Jund deck (B, R, G) -> Compatible in 3-color Jund
    const jundColors = ["B", "R", "G"];
    expect(isLandColorCompatible("Ziatora's Proving Ground", null, jundColors)).toBe(true);
  });
});

describe("landAnalyzer - Deduplication & Suggestions", () => {
  it("should never duplicate cuts for multiple printings in deck (e.g. Gruul Guildgate)", () => {
    const commander = "Grand Warlord Radha"; // R, G
    const deckCards = [
      "Gruul Guildgate",
      "Gruul Turf",
      "Stomping Ground",
      "Forest",
      "Mountain",
      "Sol Ring"
    ];

    const result = analyzeLands(commander, deckCards);

    // Gruul Guildgate must appear at most ONCE in cuts
    const guildgateCuts = result.cuts.filter(c => c.name.toLowerCase() === "gruul guildgate");
    expect(guildgateCuts.length).toBe(1);

    // Stomping Ground should NOT be in cuts
    const shockCuts = result.cuts.filter(c => c.name.toLowerCase() === "stomping ground");
    expect(shockCuts.length).toBe(0);
  });

  it("should exclude Reserved List lands by default in budget-conscious modes", () => {
    const commander = "Grand Warlord Radha"; // R, G
    const deckCards = ["Forest", "Mountain"];

    // Default analysis (excludeReservedList is true)
    const result = analyzeLands(commander, deckCards, { excludeReservedList: true });

    const taigaAdd = result.adds.find(a => a.name.toLowerCase() === "taiga");
    expect(taigaAdd).toBeUndefined();

    // With excludeReservedList false, Taiga is eligible
    const unrestrictedResult = analyzeLands(commander, deckCards, { excludeReservedList: false, budgetTier: "all" });
    const taigaAllowed = unrestrictedResult.adds.find(a => a.name.toLowerCase() === "taiga");
    expect(taigaAllowed).toBeDefined();
  });

  it("should respect liked and disliked cycles", () => {
    const commander = "Atraxa, Praetors' Voice"; // W, U, B, G
    const deckCards = ["Gruul Guildgate", "Command Tower", "Forest"];

    // If user explicitly likes Guildgates, it should NOT be cut
    const resultWithLikedGate = analyzeLands(commander, deckCards, {
      likedCycles: ["cycle-guildgate"]
    });
    const gateCut = resultWithLikedGate.cuts.find(c => c.name.toLowerCase() === "gruul guildgate");
    expect(gateCut).toBeUndefined();

    // If user dislikes shocklands, shocklands should NOT be added
    const resultWithDislikedShocks = analyzeLands(commander, deckCards, {
      dislikedCycles: ["cycle-rav-shockland"]
    });
    const shockAdd = resultWithDislikedShocks.adds.find(a => a.cycle.toLowerCase().includes("shock"));
    expect(shockAdd).toBeUndefined();
  });
});
