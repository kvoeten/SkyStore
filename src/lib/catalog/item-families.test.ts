import { describe, expect, it } from "vitest";
import { collapseItemFamilies, itemFamilyBaseName } from "./item-families";

describe("catalog item families", () => {
  it("removes numbered variant and copy suffixes", () => {
    expect(itemFamilyBaseName("Common Clothes 20")).toBe("Common Clothes");
    expect(itemFamilyBaseName("Common Clothes (03)")).toBe("Common Clothes");
    expect(itemFamilyBaseName("Iron Sword Copy 2")).toBe("Iron Sword");
  });

  it("collapses non-craftable duplicates aggressively", () => {
    const families = collapseItemFamilies([
      { id: "one", name: "Common Clothes 01", recordType: "Armor" },
      { id: "two", name: "Common Clothes 02", recordType: "Armor" },
    ]);
    expect(families).toHaveLength(1);
    expect(families[0].familyName).toBe("Common Clothes");
    expect(families[0].familyItemIds).toEqual(["one", "two"]);
  });

  it("keeps craftable variants separate when their materials differ", () => {
    const families = collapseItemFamilies([
      { id: "one", name: "Common Clothes 01", recordType: "Armor", craftSignature: "cotton:1" },
      { id: "two", name: "Common Clothes 02", recordType: "Armor", craftSignature: "cotton:2" },
    ]);
    expect(families).toHaveLength(2);
  });

  it("keeps a published all-variants group together even when its names differ", () => {
    const families = collapseItemFamilies([
      { id: "black", name: "Fur Cloak (Black)", productGroupKey: "fur-capes", productGroupLabel: "Fur Capes" },
      { id: "white", name: "Fur Cloak (White)", productGroupKey: "fur-capes", productGroupLabel: "Fur Capes" },
    ]);
    expect(families).toEqual([expect.objectContaining({ familyName: "Fur Capes", familyItemIds: ["black", "white"] })]);
  });
});
