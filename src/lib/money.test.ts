import { describe, expect, it } from "vitest";
import { formatGold, formatHighestUnitGold, formatPurchaseGold, goldBundleFromUnitPrice, roundPurchaseGold, roundSaleGold } from "./money";

describe("gold display", () => {
  it("keeps sub-gold values exact and rounds higher values for display", () => {
    expect(formatGold(0.25)).toBe("0.25g");
    expect(formatGold(1)).toBe("1g");
    expect(formatGold(1.5)).toBe("2g");
    expect(formatGold(1000)).toBe("1,000g");
  });

  it("keeps calculated store recommendations whole gold", () => {
    expect(formatPurchaseGold(0.25)).toBe("0.25g");
    expect(formatPurchaseGold(1.9)).toBe("2g");
    expect(roundPurchaseGold(19.9)).toBe(19);
    expect(roundSaleGold(19.1)).toBe(20);
  });

  it("shows the exact unit value for bundle rules", () => {
    expect(formatHighestUnitGold(1, 3)).toBe("0.33g");
    expect(formatHighestUnitGold(3, 2)).toBe("2g");
    expect(formatHighestUnitGold(20, 1)).toBe("20g");
  });

  it("converts decimal unit values into exact whole-gold bundles", () => {
    expect(goldBundleFromUnitPrice(0.25)).toEqual({ totalSeptims: 1, quantity: 4 });
    expect(goldBundleFromUnitPrice(0.2)).toEqual({ totalSeptims: 1, quantity: 5 });
    expect(goldBundleFromUnitPrice(1.5)).toEqual({ totalSeptims: 3, quantity: 2 });
    expect(goldBundleFromUnitPrice(0.333)).toBeNull();
  });

  it("rejects unusable values", () => {
    expect(formatGold(Number.NaN)).toBe("—");
    expect(formatPurchaseGold(Number.NaN)).toBe("—");
    expect(formatHighestUnitGold(1, 0)).toBe("—");
  });
});
