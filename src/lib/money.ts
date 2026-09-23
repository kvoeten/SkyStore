const goldNumber = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true
});

/** A customer-facing value always rounds upward to a whole gold piece. */
export function formatGold(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${goldNumber.format(Math.ceil(value))}g`;
}

/** A store offer always rounds downward to a whole gold piece. */
export function formatPurchaseGold(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${goldNumber.format(Math.floor(value))}g`;
}

export function roundPurchaseGold(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function roundSaleGold(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.ceil(value)) : 0;
}

/**
 * Returns the highest feasible per-item price represented by a total/quantity
 * rule, rounded up because it is a customer-facing sale value.
 */
export function formatHighestUnitGold(maximumTotal: number, minimumQuantity: number): string {
  if (!Number.isFinite(maximumTotal) || !Number.isFinite(minimumQuantity) || minimumQuantity <= 0) return "—";
  return formatGold(maximumTotal / minimumQuantity);
}
