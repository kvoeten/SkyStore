import { describe, expect, it } from "vitest";
import { formatGold, formatHighestUnitGold } from "./money";

describe("gold display", () => {
  it("uses compact g values", () => {
    expect(formatGold(0.25)).toBe(".25g");
    expect(formatGold(1)).toBe("1g");
    expect(formatGold(1.5)).toBe("1.5g");
    expect(formatGold(1000)).toBe("1,000g");
  });

  it("uses the highest feasible unit price without range notation", () => {
    expect(formatHighestUnitGold(1, 3)).toBe(".33g");
    expect(formatHighestUnitGold(3, 2)).toBe("1.5g");
    expect(formatHighestUnitGold(20, 1)).toBe("20g");
  });

  it("rejects unusable values", () => {
    expect(formatGold(Number.NaN)).toBe("—");
    expect(formatHighestUnitGold(1, 0)).toBe("—");
  });
});
