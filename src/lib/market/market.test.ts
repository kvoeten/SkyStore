import { describe, expect, it } from "vitest";
import { calculateReceipt, projectReceiptMovements, projectStock, receiptTransitionPostings } from "./receipt-math";
import { estimateMarket, publicSnapshotCutoff } from "./estimate";
import { craftReplacementCost, grossMargin, markupOnCost, recommendedMaximumPurchase, saleFloor } from "./pricing";

describe("receipt accounting", () => {
  it("preserves exact bundle totals and separates provisional stock", () => {
    const receipt = calculateReceipt([{ itemId: "wheat", quantity: 10, totalSeptims: 1 }]);
    expect(receipt.totalSeptims).toBe(1); expect(receipt.lines[0].unitPrice).toBe(0.1);
    expect(projectReceiptMovements({ direction: "store_purchase", status: "pending", lines: receipt.lines })[0]).toMatchObject({ quantityDelta: 10, bucket: "provisional" });
    expect(projectStock([{ itemId: "wheat", quantityDelta: 5, state: "confirmed" }, { itemId: "wheat", quantityDelta: -2, state: "provisional" }], "wheat")).toEqual({ confirmed: 5, provisional: -2, available: 3 });
    expect(receiptTransitionPostings({ direction: "store_sale", from: "pending", to: "approved", lines: [{ itemId: "wheat", quantity: 2 }] })).toEqual([
      { itemId: "wheat", quantityDelta: 2, bucket: "provisional", kind: "approval_transfer" }, { itemId: "wheat", quantityDelta: -2, bucket: "confirmed", kind: "approval_transfer" }
    ]);
  });
});

describe("market estimation", () => {
  it("uses recency weighting and refuses anonymized coverage below three stores", () => {
    const now = new Date("2026-08-05T00:00:00Z");
    const signals = [
      { itemId: "ore", side: "store_pays" as const, storeId: "a", kind: "receipt" as const, quantity: 1, totalSeptims: 5, occurrenceAt: new Date("2026-08-04T00:00:00Z") },
      { itemId: "ore", side: "store_pays" as const, storeId: "b", kind: "direct_quote" as const, quantity: 1, totalSeptims: 9, occurrenceAt: new Date("2026-07-31T00:00:00Z") },
      { itemId: "ore", side: "store_pays" as const, storeId: "c", kind: "hearsay" as const, quantity: 1, totalSeptims: 100, occurrenceAt: new Date("2026-04-01T00:00:00Z") }
    ];
    const estimate = estimateMarket(signals, "ore", "store_pays", now);
    expect(estimate.median).toBe(5); expect(estimate.storeCount).toBe(2); expect(estimate.anonymized).toBe(false);
    expect(publicSnapshotCutoff(now).toISOString()).toBe("2026-07-29T00:00:00.000Z");
  });
});

describe("pricing", () => {
  it("uses markup on cost and lowers buying ceiling when materials get cheaper", () => {
    expect(markupOnCost(125, 100)).toBe(0.25); expect(grossMargin(125, 100)).toBe(0.2); expect(saleFloor(100, 0.25)).toBe(125);
    const expensive = craftReplacementCost([{ quantity: 2, acquisitionRate: 50 }], 1, 10);
    const cheap = craftReplacementCost([{ quantity: 2, acquisitionRate: 20 }], 1, 10);
    expect(recommendedMaximumPurchase(200, 0.25, expensive!)).toBe(110);
    expect(recommendedMaximumPurchase(200, 0.25, cheap!)).toBe(50);
  });
});
