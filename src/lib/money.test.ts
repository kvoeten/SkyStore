import { describe, expect, it } from "vitest";
import { formatGold, formatHighestUnitGold, formatPurchaseGold, roundPurchaseGold, roundSaleGold } from "./money";

describe("gold display", () => {
  it("rounds customer-facing values upward to whole gold", () => {
    expect(formatGold(0.25)).toBe("1g");
    expect(formatGold(1)).toBe("1g");
    expect(formatGold(1.5)).toBe("2g");
    expect(formatGold(1000)).toBe("1,000g");
  });

  it("rounds store purchase offers downward to whole gold", () => {
    expect(formatPurchaseGold(0.25)).toBe("0g");
    expect(formatPurchaseGold(1.9)).toBe("1g");
    expect(roundPurchaseGold(19.9)).toBe(19);
    expect(roundSaleGold(19.1)).toBe(20);
  });

  it("uses an upward whole-gold customer price for bundle rules", () => {
    expect(formatHighestUnitGold(1, 3)).toBe("1g");
    expect(formatHighestUnitGold(3, 2)).toBe("2g");
    expect(formatHighestUnitGold(20, 1)).toBe("20g");
  });

  it("rejects unusable values", () => {
    expect(formatGold(Number.NaN)).toBe("—");
    expect(formatPurchaseGold(Number.NaN)).toBe("—");
    expect(formatHighestUnitGold(1, 0)).toBe("—");
  });
});
