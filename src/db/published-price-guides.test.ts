import { describe, expect, it } from "vitest";
import { resolvePublishedPriceGuide } from "./published-price-guides";

describe("published price guides", () => {
  it("applies a stated all-variants tailoring price to every matching catalog record", () => {
    const { rules } = resolvePublishedPriceGuide([
      { id: "black", name: "Fur Cloak (Black)", category: "Armor & clothing" },
      { id: "white", name: "Fur Cloak (White)", category: "Armor & clothing" },
    ]);
    expect(rules.filter((rule) => rule.sourceLabel.endsWith(": Fur Capes"))).toEqual([
      expect.objectContaining({ itemId: "black", side: "customer_pays", totalSeptims: 40 }),
      expect.objectContaining({ itemId: "white", side: "customer_pays", totalSeptims: 40 }),
    ]);
  });

  it("keeps raw produce input rates private", () => {
    const { rules } = resolvePublishedPriceGuide([{ id: "wheat", name: "Wheat", category: "Ingredients" }]);
    expect(rules).toContainEqual(expect.objectContaining({ itemId: "wheat", side: "store_pays", totalSeptims: 1 }));
    expect(rules).not.toContainEqual(expect.objectContaining({ itemId: "wheat", side: "customer_pays" }));
  });

  it("stores fractional published values as exact integer bundles", () => {
    const { rules } = resolvePublishedPriceGuide([{ id: "apple", name: "Red Apple", category: "Food" }]);
    expect(rules).toContainEqual(expect.objectContaining({ itemId: "apple", side: "store_pays", totalSeptims: 1, quantity: 2 }));
  });
});
