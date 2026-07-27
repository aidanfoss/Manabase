import { describe, it, expect } from "vitest";
import { scrapeLotusCard } from "../services/lotusvault.js";
import { optimizeManaPoolCart } from "../services/manapool.js";

describe("Pricing Services", () => {
    it("should scrape LotusVault card data", async () => {
        const res = await scrapeLotusCard("Sol Ring");
        expect(res).toBeDefined();
        expect(res.cardName).toBe("Sol Ring");
        expect(Array.isArray(res.items)).toBe(true);
    }, 15000);

    it("should optimize cart with ManaPool API", async () => {
        const cart = [{ name: "Sol Ring", quantity: 1 }];
        const res = await optimizeManaPoolCart(cart);
        expect(res).toBeDefined();
        expect(res.success).toBe(true);
        expect(parseFloat(res.total)).toBeGreaterThan(0);
        expect(parseFloat(res.shipping)).toBeGreaterThanOrEqual(0);
    }, 15000);
});
