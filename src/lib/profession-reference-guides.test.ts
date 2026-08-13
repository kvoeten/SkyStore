import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SMITHING_ARMOR_SETS, SMITHING_REFERENCE_QUALITIES } from "@/lib/profession-reference-guides";

describe("smithing reference guide", () => {
  it("calculates every full-set price from four armor pieces", () => {
    for (const set of SMITHING_ARMOR_SETS) {
      expect(set.components.map((component) => component.slot)).toEqual(["Head", "Body", "Hands", "Feet"]);
      expect(set.totalPrice).toBe(set.components.reduce((sum, component) => sum + component.price, 0));
    }
    expect(SMITHING_ARMOR_SETS.find((set) => set.name === "Iron")?.totalPrice).toBe(82);
    expect(SMITHING_ARMOR_SETS.find((set) => set.name === "Gilded Ebony")?.totalPrice).toBe(936169);
    const ironArrow = SMITHING_REFERENCE_QUALITIES.find((quality) => quality.quality === "Iron")?.items.find((item) => item.catalogName === "Iron Arrow");
    expect(ironArrow).toMatchObject({ price: 6, priceQuantity: 24 });
  });

  it("maps every displayed smithing entry to a real item in the extracted catalog", () => {
    const catalog = JSON.parse(readFileSync("catalog/generated/skystore-catalog-current.json", "utf8")) as { items: Array<{ name: string }> };
    const names = new Set(catalog.items.map((item) => item.name));
    const targets = new Set([
      ...SMITHING_REFERENCE_QUALITIES.flatMap((quality) => quality.items.map((item) => item.catalogName)),
      ...SMITHING_ARMOR_SETS.flatMap((set) => set.components.map((component) => component.catalogName)),
    ]);
    expect([...targets].filter((name) => !names.has(name))).toEqual([]);
  });
});
