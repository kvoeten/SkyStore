import { describe, expect, it } from "vitest";
import { resolvePublishedBaseCosts, resolvePublishedPriceGuide } from "./published-price-guides";

describe("published price guides", () => {
  it("lets a current all-cloaks update supersede an older tailoring group price", () => {
    const { rules } = resolvePublishedPriceGuide([
      { id: "black", name: "Fur Cloak (Black)", category: "Armor & clothing" },
      { id: "white", name: "Fur Cloak (White)", category: "Armor & clothing" },
    ]);
    expect(rules.filter((rule) => rule.sourceLabel.endsWith(": Cloaks") && rule.side === "customer_pays")).toEqual([
      expect.objectContaining({ itemId: "black", side: "customer_pays", totalSeptims: 50 }),
      expect.objectContaining({ itemId: "white", side: "customer_pays", totalSeptims: 50 }),
    ]);
  });

  it("keeps a stated public wheat sale rate distinct from its intake rate", () => {
    const { rules } = resolvePublishedPriceGuide([{ id: "wheat", name: "Wheat", category: "Ingredients" }]);
    expect(rules).toContainEqual(expect.objectContaining({ itemId: "wheat", side: "store_pays", totalSeptims: 1, quantity: 2 }));
    expect(rules).toContainEqual(expect.objectContaining({ itemId: "wheat", side: "customer_pays", totalSeptims: 6, quantity: 2 }));
  });

  it("stores fractional published values as exact integer bundles", () => {
    const { rules } = resolvePublishedPriceGuide([{ id: "apple", name: "Red Apple", category: "Food" }]);
    expect(rules).toContainEqual(expect.objectContaining({ itemId: "apple", side: "store_pays", totalSeptims: 1, quantity: 2 }));
  });

  it("keeps blacksmith raw values as base costs rather than store purchase offers", () => {
    const items = [
      { id: "quicksilver", name: "Quicksilver Ore", category: "Ores & ingots" },
      { id: "iron", name: "Iron Ore", category: "Ores & ingots" },
      { id: "iron-ingot", name: "Iron Ingot", category: "Ores & ingots" },
      { id: "flower", name: "Blue Mountain Flower", category: "Alchemy ingredients" },
    ];
    const { rules } = resolvePublishedPriceGuide(items);
    const { rules: baseCosts } = resolvePublishedBaseCosts(items);

    expect(baseCosts).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: "quicksilver", totalSeptims: 20, quantity: 1 }),
      expect.objectContaining({ itemId: "iron", totalSeptims: 1, quantity: 4 }),
      expect.objectContaining({ itemId: "iron-ingot", totalSeptims: 1, quantity: 1 }),
      expect.objectContaining({ itemId: "flower", totalSeptims: 1, quantity: 5 }),
    ]));
    expect(rules.some((rule) => rule.itemId === "quicksilver" && rule.sourceLabel.includes("Blacksmith material"))).toBe(false);
  });

  it("imports confirmed profession leaves as material costs only", () => {
    const items = [
      { id: "stalhrim", name: "Stalhrim", category: "Ores & ingots" },
      { id: "diamond", name: "Diamond", category: "Miscellaneous" },
      { id: "bear", name: "Bear Pelt", category: "Hides & leather" },
    ];
    const { rules } = resolvePublishedBaseCosts(items);

    expect(rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: "stalhrim", totalSeptims: 50, quantity: 1, sourceLabel: expect.stringContaining("confirmed") }),
      expect.objectContaining({ itemId: "diamond", totalSeptims: 100, quantity: 1, sourceLabel: expect.stringContaining("confirmed") }),
      expect.objectContaining({ itemId: "bear", totalSeptims: 3, quantity: 1, sourceLabel: expect.stringContaining("confirmed") }),
    ]));
  });
});
