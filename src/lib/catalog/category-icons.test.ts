import { describe, expect, it } from "vitest";
import { categoryIconPath } from "./category-icons";

describe("categoryIconPath", () => {
  it.each([
    ["Red Apple", "Food & drink", "/catalog-icons/food.png"],
    ["Iron Armor", "Armor & clothing", "/catalog-icons/armor.png"],
    ["Iron Sword", "Weapons", "/catalog-icons/weapon.png"],
    ["Spell Tome: Fireball", "Spell tomes", "/catalog-icons/book.png"],
    ["Potion of Healing", "Potions & poisons", "/catalog-icons/potion.png"],
    ["Blue Mountain Flower", "Alchemy ingredients", "/catalog-icons/flower.png"],
    ["Iron Ore", "Ores & ingots", "/catalog-icons/ore.png"],
    ["Iron Ingot", "Ores & ingots", "/catalog-icons/ingot.png"],
    ["Lockpick", "Tools & supplies", "/catalog-icons/misc.png"]
  ])("maps %s to its calm list icon", (name, category, expected) => {
    expect(categoryIconPath({ name, category })).toBe(expected);
  });
});
