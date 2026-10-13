/** A new value has no measurable percentage change until a positive baseline exists. */
export function trendChangePercent(current: number | null, previous: number | null): number {
  if (current == null || previous == null || previous <= 0 || !Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  return ((current - previous) / previous) * 100;
}
