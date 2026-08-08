export type MarketGuideRankable = {
  readonly name: string;
  readonly hasPrice: boolean;
  readonly lastSoldAt?: string | Date | null;
  readonly recentUnitsSold?: number;
};

function soldAtValue(value: MarketGuideRankable["lastSoldAt"]): number {
  if (!value) return 0;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Default browsing is a useful sales list, while search remains the full catalog. */
export function prioritizeMarketGuideRows<T extends MarketGuideRankable>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => {
    const activity = soldAtValue(right.lastSoldAt) - soldAtValue(left.lastSoldAt);
    if (activity) return activity;
    if (left.hasPrice !== right.hasPrice) return left.hasPrice ? -1 : 1;
    const volume = (right.recentUnitsSold ?? 0) - (left.recentUnitsSold ?? 0);
    if (volume) return volume;
    return left.name.localeCompare(right.name);
  });
}

export function isMarketGuideBrowseCandidate(row: MarketGuideRankable): boolean {
  return row.hasPrice || soldAtValue(row.lastSoldAt) > 0;
}
