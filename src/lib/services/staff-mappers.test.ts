import { describe, expect, it } from "vitest";
import { calculateSalesReport, mapInventoryRow } from "./staff-mappers";

describe("staff response mapping", () => {
  it("keeps confirmed and provisional stock separate", () => {
    expect(mapInventoryRow({ itemId: "i", stableKey: "iron", displayName: "Iron Ore", category: "ore", confirmed: "6", provisional: "-2" })).toMatchObject({ ledgerConfirmedStock: 6, ledgerAvailableStock: 4, confirmedStock: 6, provisionalStock: -2, availableStock: 4 });
  });
  it("floors an oversold inventory row without discarding its ledger deficit", () => {
    expect(mapInventoryRow({ itemId: "i", stableKey: "iron", displayName: "Iron Ore", category: "ore", confirmed: "-2", provisional: "0" })).toMatchObject({ ledgerConfirmedStock: -2, ledgerAvailableStock: -2, confirmedStock: 0, availableStock: 0 });
  });
  it("calculates COGS only from available historic purchase cost", () => {
    const result = calculateSalesReport([
      { itemId: "ore", direction: "store_purchase", quantity: 10, totalSeptims: 20, occurrenceAt: new Date("2026-08-01T00:00:00Z") },
      { itemId: "ore", direction: "store_sale", quantity: 4, totalSeptims: 20, occurrenceAt: new Date("2026-08-02T00:00:00Z") },
      { itemId: "new", direction: "store_sale", quantity: 1, totalSeptims: 5, occurrenceAt: new Date("2026-08-02T00:00:00Z") }
    ], new Date("2026-08-01T00:00:00Z"), new Date("2026-08-03T00:00:00Z"));
    expect(result).toMatchObject({ salesSeptims: 25, costOfGoodsSeptims: 8, grossProfitSeptims: 17, knownCostUnits: 4, unknownCostUnits: 1 });
  });
  it("consumes sales before the report window when finding remaining cost", () => {
    const result = calculateSalesReport([
      { itemId: "ore", direction: "store_purchase", quantity: 10, totalSeptims: 20, occurrenceAt: new Date("2026-08-01T00:00:00Z") },
      { itemId: "ore", direction: "store_sale", quantity: 8, totalSeptims: 40, occurrenceAt: new Date("2026-08-02T00:00:00Z") },
      { itemId: "ore", direction: "store_sale", quantity: 4, totalSeptims: 20, occurrenceAt: new Date("2026-08-03T00:00:00Z") }
    ], new Date("2026-08-03T00:00:00Z"), new Date("2026-08-04T00:00:00Z"));
    expect(result).toMatchObject({ salesSeptims: 20, costOfGoodsSeptims: 4, knownCostUnits: 2, unknownCostUnits: 2 });
  });
});
