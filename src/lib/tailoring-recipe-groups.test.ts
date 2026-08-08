import { describe, expect, it } from "vitest";
import { groupTailoringRecipeVariants } from "./tailoring-recipe-groups";

function recipe(id: string, outputName: string, overrides: Partial<ReturnType<typeof recipeFixture>> = {}) {
  return { ...recipeFixture(), id, outputItemId: `item-${id}`, outputName, ...overrides };
}

function recipeFixture() {
  return {
    id: "recipe", outputItemId: "item", outputName: "Common Robes 01", outputYield: 1,
    masteryTier: "Advanced", laborFee: 0, conditions: ["requires:profession:Tailoring:Advanced"],
    ingredients: [{ itemId: "cotton", quantity: 5 }, { itemId: "leather", quantity: 2 }],
    materialCost: 6 as number | null, productPrice: 20 as number | null, missingPriceCount: 0,
  };
}

describe("tailoring recipe variant groups", () => {
  it("collapses numbered variants with an identical recipe and shares their highest reported price", () => {
    const result = groupTailoringRecipeVariants([
      recipe("3", "Common Robes 03", { productPrice: null }),
      recipe("5", "Common Robes 05", { productPrice: 20 }),
      recipe("12", "Common Robes 12", { productPrice: 25 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe("Common Robes 03–12");
    expect(result[0].priceReportItemId).toBe("item-3");
    expect(result[0].productPrice).toBe(25);
    expect(result[0].variants.map((variant) => variant.outputName)).toEqual(["Common Robes 03", "Common Robes 05", "Common Robes 12"]);
  });

  it("keeps different mastery, recipes, requirements, and unnumbered names separate", () => {
    const result = groupTailoringRecipeVariants([
      recipe("1", "Common Robes 01"),
      recipe("2", "Common Robes 02", { masteryTier: "Expert" }),
      recipe("3", "Common Robes 03", { ingredients: [{ itemId: "cotton", quantity: 6 }] }),
      recipe("4", "Common Robes 04", { conditions: ["requires:book:Tailor Variant Book"] }),
      recipe("plain", "Common Robes"),
    ]);
    expect(result).toHaveLength(5);
    expect(result.every((entry) => entry.variants.length === 1)).toBe(true);
  });

  it("does not combine different numbered name families", () => {
    const result = groupTailoringRecipeVariants([
      recipe("1", "Common Robes 01"), recipe("2", "Common Robes Hooded 02"),
    ]);
    expect(result).toHaveLength(2);
  });
});
