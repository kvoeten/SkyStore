import { describe, expect, it } from "vitest";
import { SEED_CATALOG_ITEMS, SEED_OFFICIAL_RATES } from "./seed";

function ratesFor(stableKey: string) {
  return SEED_OFFICIAL_RATES.filter((rate) => rate.stableKey === stableKey);
}

describe("Whiterun opening-price transcription", () => {
  it("keeps every rule attached to a seeded catalog item", () => {
    const itemKeys = new Set(SEED_CATALOG_ITEMS.map(([stableKey]) => stableKey));
    expect(SEED_OFFICIAL_RATES.every((rate) => itemKeys.has(rate.stableKey))).toBe(true);
  });

  it.each(["iron-ore", "corundum-ore"])("preserves both ore sides and bundle ranges for %s", (stableKey) => {
    expect(ratesFor(stableKey)).toEqual(expect.arrayContaining([
      expect.objectContaining({ side: "store_pays", quantity: 10, maximumQuantity: 10, minimumSeptims: 1, maximumSeptims: 1 }),
      expect.objectContaining({ side: "customer_pays", quantity: 3, maximumQuantity: 4, minimumSeptims: 1, maximumSeptims: 1 })
    ]));
  });

  it("preserves the asymmetric wheat and leather rules", () => {
    expect(ratesFor("wheat")).toEqual(expect.arrayContaining([
      expect.objectContaining({ side: "store_pays", quantity: 2, minimumSeptims: 1 }),
      expect.objectContaining({ side: "customer_pays", quantity: 2, minimumSeptims: 3 })
    ]));
    expect(ratesFor("leather")).toEqual(expect.arrayContaining([
      expect.objectContaining({ side: "store_pays", quantity: 2, minimumSeptims: 1 }),
      expect.objectContaining({ side: "customer_pays", quantity: 1, minimumSeptims: 2 })
    ]));
  });
});
