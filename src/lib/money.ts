const goldNumber = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: true
});

function omitLeadingZero(value: string): string {
  if (value.startsWith("0.")) return value.slice(1);
  if (value.startsWith("-0.")) return `-${value.slice(2)}`;
  return value;
}

/** Formats a displayed gold value without changing the integer ledger storage. */
export function formatGold(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${omitLeadingZero(goldNumber.format(value))}g`;
}

/**
 * Returns the highest feasible per-item price represented by a total/quantity
 * rule. A rule of 3–4 items for 1 gold therefore displays as .33g.
 */
export function formatHighestUnitGold(maximumTotal: number, minimumQuantity: number): string {
  if (!Number.isFinite(maximumTotal) || !Number.isFinite(minimumQuantity) || minimumQuantity <= 0) return "—";
  return formatGold(maximumTotal / minimumQuantity);
}
