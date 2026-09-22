import { describe, expect, it } from "vitest";
import { resolvePublishedPriceGuide } from "./published-price-guides";

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
});
