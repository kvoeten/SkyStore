import { describe, expect, it } from "vitest";
import { trendChangePercent } from "./trend-change";

describe("price trend baseline", () => {
  it("shows no percentage movement for a zero or missing previous value", () => {
    expect(trendChangePercent(8, 0)).toBe(0);
    expect(trendChangePercent(8, null)).toBe(0);
  });
  it("keeps actual changes from positive prices", () => {
    expect(trendChangePercent(8, 1)).toBe(700);
    expect(trendChangePercent(0, 8)).toBe(-100);
  });
});
