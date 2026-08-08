export type SignalKind = "receipt" | "seen_listing" | "direct_quote" | "hearsay";
export type MarketSignal = {
  itemId: string; side: "store_pays" | "customer_pays"; storeId?: string | null; kind: SignalKind;
  totalSeptims: number; quantity: number; occurrenceAt: Date; approved?: boolean; quarantined?: boolean; expiresAt?: Date | null;
};
export type MarketEstimate = {
  median: number | null; lowerQuartile: number | null; upperQuartile: number | null; signalCount: number; storeCount: number;
  newestEvidenceAt: Date | null; confidence: number; anonymized: boolean; insufficientCoverage: boolean;
};

const HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;
const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const SIGNAL_WEIGHT: Record<SignalKind, number> = { receipt: 1, seen_listing: 0.35, direct_quote: 0.35, hearsay: 0.2 };

function weightedQuantile(values: Array<{ value: number; weight: number }>, percentile: number): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a.value - b.value);
  const totalWeight = ordered.reduce((sum, value) => sum + value.weight, 0);
  if (totalWeight === 0) return null;
  const target = totalWeight * percentile;
  let cumulative = 0;
  for (const entry of ordered) { cumulative += entry.weight; if (cumulative >= target) return entry.value; }
  return ordered.at(-1)!.value;
}

export function estimateMarket(signals: Iterable<MarketSignal>, itemId: string, side: MarketSignal["side"], now = new Date(), sourceCutoffAt?: Date): MarketEstimate {
  const nowMs = now.getTime();
  const valid = [...signals].filter((signal) => {
    const age = nowMs - signal.occurrenceAt.getTime();
    return signal.itemId === itemId && signal.side === side && signal.quantity > 0 && signal.totalSeptims >= 0 && !signal.quarantined && signal.approved !== false &&
      age >= 0 && age <= WINDOW_MS && (!signal.expiresAt || signal.expiresAt > now) && (!sourceCutoffAt || signal.occurrenceAt <= sourceCutoffAt);
  });
  const weighted = valid.map((signal) => ({ value: signal.totalSeptims / signal.quantity, weight: SIGNAL_WEIGHT[signal.kind] * 2 ** (-(nowMs - signal.occurrenceAt.getTime()) / HALF_LIFE_MS) }));
  const stores = new Set(valid.flatMap((signal) => signal.storeId ? [signal.storeId] : []));
  const newestEvidenceAt = valid.reduce<Date | null>((newest, signal) => !newest || signal.occurrenceAt > newest ? signal.occurrenceAt : newest, null);
  const rawConfidence = Math.min(1, (weighted.reduce((sum, signal) => sum + signal.weight, 0) / 8) * Math.min(1, stores.size / 3));
  const anonymized = stores.size >= 3;
  return {
    median: weightedQuantile(weighted, 0.5), lowerQuartile: weightedQuantile(weighted, 0.25), upperQuartile: weightedQuantile(weighted, 0.75),
    signalCount: valid.length, storeCount: stores.size, newestEvidenceAt, confidence: Number(rawConfidence.toFixed(4)), anonymized, insufficientCoverage: !anonymized
  };
}

/** The snapshot task is the only public data path. Caller must persist this output, never browser-filter live data. */
export function publicSnapshotCutoff(now = new Date()): Date { return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); }

export function isPublicEvidence(signal: Pick<MarketSignal, "occurrenceAt">, now = new Date()): boolean {
  return signal.occurrenceAt.getTime() <= publicSnapshotCutoff(now).getTime();
}
