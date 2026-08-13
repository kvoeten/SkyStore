import { describe, expect, it } from "vitest";
import { effectiveMarketCategory, inferMarketCategory } from "./market-categories";

describe("market browse categories", () => {
  it("classifies common farm, hunting, dungeon, and foraging goods", () => {
    expect(inferMarketCategory({ name: "Wheat", category: "Food" })).toBe("farm-produce");
    expect(inferMarketCategory({ name: "Bear Pelt", category: "Miscellaneous" })).toBe("hunting-loot");
    expect(inferMarketCategory({ name: "Bear Claws", category: "Alchemy", recordType: "Ingredient" })).toBe("hunting-loot");
    expect(inferMarketCategory({ name: "Golden Claw", category: "Miscellaneous" })).toBe("dungeon-loot");
    expect(inferMarketCategory({ name: "Petty Soul Gem", category: "Soul gems" })).toBe("dungeon-loot");
    expect(inferMarketCategory({ name: "Blue Mountain Flower", category: "Alchemy", recordType: "Ingredient" })).toBe("foraging-loot");
  });

  it("gives an administrator override precedence", () => {
    expect(effectiveMarketCategory({ name: "Wheat", category: "Food", marketCategory: "dungeon-loot" })).toBe("dungeon-loot");
  });

  it("does not mistake prepared food or partial words for raw farm produce", () => {
    expect(inferMarketCategory({ name: "Apple Dumpling", category: "Food" })).toBeNull();
    expect(inferMarketCategory({ name: "Beggar Prince", category: "Book" })).toBeNull();
  });
});
