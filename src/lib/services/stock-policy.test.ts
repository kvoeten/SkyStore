import { describe, expect, it } from "vitest";
import { mapStockBalance, receiptQuantityDelta } from "./stock-policy";

describe("stock policy", () => {
  it("posts purchase and sale movements without consulting reported stock", () => {
    expect(receiptQuantityDelta("store_purchase", 4)).toBe(4);
    expect(receiptQuantityDelta("store_sale", 4)).toBe(-4);
  });

  it("retains an oversold ledger balance while flooring the inventory snapshot", () => {
    expect(mapStockBalance(-3, 0)).toEqual({
      ledgerConfirmedStock: -3,
      ledgerAvailableStock: -3,
      confirmedStock: 0,
      provisionalStock: 0,
      availableStock: 0
    });
  });

  it("keeps a pending sale in the ledger while preventing a negative available shelf count", () => {
    expect(mapStockBalance(2, -5)).toMatchObject({
      ledgerConfirmedStock: 2,
      ledgerAvailableStock: -3,
      confirmedStock: 2,
      provisionalStock: -5,
      availableStock: 0
    });
  });
});
