import { describe, it, expect } from "vitest";
import { reloadLocalScryfall, ensureLoaded, searchLocalCards, getLocalCardByName, getLocalCardsBatch } from "../routes/scryfallLocal.js";

describe("Scryfall Local Search & Reload", () => {
  it("should ensure cards are loaded and searchable", async () => {
    await ensureLoaded();
    
    // Test exact card query
    const results = await searchLocalCards("Sol Ring");
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);

    // If bulk data is present, Sol Ring should be found
    if (results.length > 0) {
      expect(results[0].name.toLowerCase()).toContain("sol ring");
    }
  });

  it("should force reload local scryfall when reloadLocalScryfall(true) is invoked", async () => {
    await reloadLocalScryfall(true);
    const card = await getLocalCardByName("Lightning Bolt");
    if (card) {
      expect(card.name).toBe("Lightning Bolt");
    }
  });

  it("should support batch retrieval via getLocalCardsBatch", async () => {
    await ensureLoaded();
    const batch = await getLocalCardsBatch(["Sol Ring", "Counterspell"]);
    expect(batch).toBeDefined();
    expect(typeof batch).toBe("object");
  });
});
