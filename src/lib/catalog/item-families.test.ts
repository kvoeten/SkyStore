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
});
