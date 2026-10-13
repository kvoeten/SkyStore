import { describe, expect, it } from "vitest";
import { rebaseCorrectedTrend } from "./trend-baseline";
describe("corrected reference trends", () => {
  it("excludes pre-repair values without losing separate store prices or later trades", () => {
    const points = [{ at: "2026-09-20", value: 50, store_pays: 15 }, { at: "2026-09-23", value: 310 }, { at: "2026-10-01", value: 320 }];
    expect(rebaseCorrectedTrend(points, new Date("2026-09-23"))).toEqual([{ at: "2026-09-20", store_pays: 15 }, points[1], points[2]]);
  });
  it("leaves uncorrected history unchanged", () => {
    const points = [{ at: "2026-09-20", value: 50 }];
    expect(rebaseCorrectedTrend(points, null)).toBe(points);
  });
});
