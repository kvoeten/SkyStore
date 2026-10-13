/** Administrative reference repairs start a new comparable value baseline. */
export function rebaseCorrectedTrend<T extends { at: string; value?: number | null }>(points: T[], correctedAt: Date | null): T[] {
  if (!correctedAt) return points;
  return points.flatMap((point) => {
    if (point.value == null || Date.parse(point.at) >= correctedAt.getTime()) return [point];
    const { value: ignored, ...other } = point;
    void ignored;
    return [other as T];
  });
}
