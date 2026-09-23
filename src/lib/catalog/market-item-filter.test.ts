import { describe, expect, it } from "vitest";
import { isMarketItemDisplayable } from "./market-item-filter";

describe("market catalog filtering", () => {
  it("keeps genuine market items", () => {
    expect(isMarketItemDisplayable({ displayName: "Iron Ore" })).toBe(true);
    expect(isMarketItemDisplayable({ displayName: "Cloak of the Áshlander" })).toBe(true);
  });

  it("hides mojibake, aliases, and debug records without deleting them", () => {
    expect(isMarketItemDisplayable({ displayName: "Ã " })).toBe(false);
    expect(isMarketItemDisplayable({ displayName: "<Alias=Home> Furnishings" })).toBe(false);
    expect(isMarketItemDisplayable({ displayName: "DummyPotion" })).toBe(false);
    expect(isMarketItemDisplayable({ displayName: "DLC2TestItem" })).toBe(false);
    expect(isMarketItemDisplayable({ displayName: "123 Abc Def Ghi", editorId: "QABook" })).toBe(false);
  });
});
