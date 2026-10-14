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

  it("should strictly restrict recommended additions to liked land cycles when likedCycles are provided", () => {
    // Dimir commander (Wilhelt, the Rotcleaver: U, B)
    const commander = "Wilhelt, the Rotcleaver";
    const deckCards = ["Island", "Swamp", "Drowned Catacomb"];

    // User only likes Painlands and Slowlands
    const result = analyzeLands(commander, deckCards, {
      likedCycles: ["cycle-painland", "cycle-slowland"]
    });

    // Every suggested addition must belong to Painlands or Slowlands
    expect(result.adds.length).toBeGreaterThan(0);
    for (const add of result.adds) {
      const cycleLower = (add.cycle || "").toLowerCase();
      const isPainOrSlow = cycleLower.includes("pain") || cycleLower.includes("slow");
      expect(isPainOrSlow).toBe(true);
    }

    // Should include Underground River and Shipwreck Marsh
    const addNames = result.adds.map(a => a.name);
    expect(addNames).toContain("Underground River");
    expect(addNames).toContain("Shipwreck Marsh");

    // Must NOT include Shocklands (Watery Grave), Fetchlands (Polluted Delta), or Bondlands (Morphic Pool)
    expect(addNames).not.toContain("Watery Grave");
    expect(addNames).not.toContain("Polluted Delta");
    expect(addNames).not.toContain("Morphic Pool");
  });

  it("should correctly resolve cycle aliases such as 'painlands', 'slowland', and 'shocks'", () => {
    const commander = "Wilhelt, the Rotcleaver";
    const deckCards = ["Island", "Swamp"];

    const result = analyzeLands(commander, deckCards, {
      likedCycles: ["painlands", "shocks"]
    });

    const addNames = result.adds.map(a => a.name);
    expect(addNames).toContain("Underground River");
    expect(addNames).toContain("Watery Grave");
    expect(addNames).not.toContain("Shipwreck Marsh");
  });

  it("should return 0 adds if user explicitly sets likedCycles to an empty array", () => {
    const commander = "Wilhelt, the Rotcleaver";
    const deckCards = ["Island", "Swamp"];

    const result = analyzeLands(commander, deckCards, {
      likedCycles: []
    });

    expect(result.adds).toEqual([]);
  });

  it("should return 0 adds if deck already contains all on-color lands from liked cycles", () => {
    const commander = "Wilhelt, the Rotcleaver";
    // Dimir deck that already has the Dimir painland and slowland
    const deckCards = ["Island", "Swamp", "Underground River", "Shipwreck Marsh"];

    const result = analyzeLands(commander, deckCards, {
      likedCycles: ["cycle-painland", "cycle-slowland"]
    });

    expect(result.adds).toEqual([]);
  });

  it("should gracefully handle decks without a defined commander by inferring colors from cards", () => {
    // Deck with no commander, but Dimir basic lands (Island + Swamp)
    const deckCards = ["Island", "Swamp", "Dismal Backwater", "Sol Ring"];

    // Null commander
    const nullCmdResult = analyzeLands(null, deckCards);
    expect(nullCmdResult.colorIdentity).toEqual(expect.arrayContaining(["B", "U"]));
    expect(nullCmdResult.cuts.some(c => c.name.toLowerCase() === "dismal backwater")).toBe(true);
    expect(nullCmdResult.adds.some(a => a.name.toLowerCase() === "watery grave" || a.name.toLowerCase() === "morphic pool" || a.name.toLowerCase() === "underground river")).toBe(true);

    // "Unknown" / "None" / empty string commander
    const unknownCmdResult = analyzeLands("Unknown", deckCards);
    expect(unknownCmdResult.colorIdentity).toEqual(expect.arrayContaining(["B", "U"]));

    const emptyCmdResult = analyzeLands("", deckCards);
    expect(emptyCmdResult.colorIdentity).toEqual(expect.arrayContaining(["B", "U"]));

    // Completely empty deck
    const emptyDeckResult = analyzeLands(null, []);
    expect(emptyDeckResult.colorIdentity).toEqual([]);
    expect(emptyDeckResult.cuts).toEqual([]);
    // Any suggested adds in a 0-color deck must have reqColors: [] (colorless only)
    for (const add of emptyDeckResult.adds) {
      expect(getLandRequiredColors(add.name, null)).toEqual([]);
    }
  });
});
