import { describe, expect, it } from "vitest";
import { parseRecipeRequirements } from "./recipe-requirements";

describe("recipe requirements", () => {
  it("keeps profession level and additional gates distinct", () => {
    expect(parseRecipeRequirements([
      "requires:profession:Tailoring:Master",
      "requires:book:College Recipe Book",
      "requires:perk:Steel Smithing",
      "condition:unmapped",
    ])).toEqual([
      { kind: "profession", label: "Master Tailoring", description: "Profession level", alternativeGroup: null },
      { kind: "book", label: "College Recipe Book", description: "Recipe book", alternativeGroup: null },
      { kind: "perk", label: "Steel Smithing", description: "Perk", alternativeGroup: null },
    ]);
  });

  it("keeps alternative conditions in one group", () => {
    expect(parseRecipeRequirements([
      "requires:any:0:book:Cultist Recipe Book",
      "requires:any:0:book:Priests Recipe Book",
    ])).toEqual([
      { kind: "book", label: "Cultist Recipe Book", description: "Recipe book", alternativeGroup: "0" },
      { kind: "book", label: "Priests Recipe Book", description: "Recipe book", alternativeGroup: "0" },
    ]);
  });

  it("deduplicates repeated requirements", () => {
    expect(parseRecipeRequirements(["requires:book:Special Elixir Recipes", "requires:book:Special Elixir Recipes"]))
      .toHaveLength(1);
  });
});
