import { describe, expect, it } from "vitest";
import { isMarketGuideBrowseCandidate, prioritizeMarketGuideRows } from "./guide-ranking";

describe("market guide browsing priority", () => {
  it("puts recently sold items ahead of priced-only and unavailable entries", () => {
    const rows = prioritizeMarketGuideRows([
      { id: "priced", name: "Moonstone", hasPrice: true },
      { id: "missing", name: "Quest Relic", hasPrice: false },
      { id: "older", name: "Leather", hasPrice: true, lastSoldAt: "2026-07-01T00:00:00Z", recentUnitsSold: 40 },
      { id: "newer", name: "Wheat", hasPrice: true, lastSoldAt: "2026-08-01T00:00:00Z", recentUnitsSold: 2 }
    ]);

    expect(rows.map((row) => row.id)).toEqual(["newer", "older", "priced", "missing"]);
  });

  it("keeps price or sale activity in default browsing while search may include anything", () => {
    expect(isMarketGuideBrowseCandidate({ name: "Iron Ore", hasPrice: true })).toBe(true);
    expect(isMarketGuideBrowseCandidate({ name: "Leather", hasPrice: false, lastSoldAt: new Date("2026-08-01T00:00:00Z") })).toBe(true);
    expect(isMarketGuideBrowseCandidate({ name: "Unobtainable Relic", hasPrice: false })).toBe(false);
  });
});
