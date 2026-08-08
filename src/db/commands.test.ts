import { describe, expect, it } from "vitest";
import { createReceiptCommand, stockReconciliationCommand, submitObservationCommand, submitPublicMarketReportCommand } from "./commands";

const itemId = "d3aa78a5-a1b6-49f1-a706-4d54c698711e";

describe("public market report command", () => {
  it("accepts a bounded authenticated contribution", () => {
    expect(submitPublicMarketReportCommand.safeParse({ itemId, quantity: 10, totalSeptims: 25, locationType: "store_sale", displayName: "Aela of Whiterun" }).success).toBe(true);
  });

  it.each([
    { quantity: 0, totalSeptims: 2, locationType: "store_sale" },
    { quantity: 1, totalSeptims: -1, locationType: "street_sale" },
    { quantity: 1, totalSeptims: 1, locationType: "unknown" }
  ])("rejects invalid report values", (input) => {
    expect(submitPublicMarketReportCommand.safeParse({ itemId, ...input }).success).toBe(false);
  });
});

describe("fast staff entry commands", () => {
  it("accepts a receipt without a manually supplied time or counterparty", () => {
    const result = createReceiptCommand.safeParse({
      storeId: itemId,
      direction: "store_purchase",
      lines: [{ itemId, quantity: 4, totalSeptims: 1 }]
    });
    expect(result.success).toBe(true);
  });

  it("accepts only the item, quantity, and price for a street report", () => {
    const result = submitObservationCommand.safeParse({ storeId: itemId, itemId, quantity: 1, totalSeptims: 20 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ storeId: itemId, itemId, quantity: 1, totalSeptims: 20 });
  });

  it("accepts an absolute stock reconciliation without requiring a manager-only delta or reason", () => {
    expect(stockReconciliationCommand.safeParse({ storeId: itemId, itemId, actualQuantity: 0 }).success).toBe(true);
    expect(stockReconciliationCommand.safeParse({ storeId: itemId, itemId, actualQuantity: -1 }).success).toBe(false);
  });
});
