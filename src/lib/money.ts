const goldNumber = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: true
});

/**
 * Keeps sub-gold material values exact when a trade is normally paid as a
 * bundle (0.25g means 1g for 4), while values above 1g read as the nearest
 * whole-gold amount. Receipt totals remain whole gold.
 */
export function formatGold(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${goldNumber.format(value > 1 ? Math.round(value) : value)}g`;
}

/** Store offers can use the same exact per-item notation as public values. */
export function formatPurchaseGold(value: number | null | undefined): string {
  return formatGold(value);
}

export type GoldBundle = { totalSeptims: number; quantity: number };

/** Convert a decimal per-item value into the smallest exact whole-gold bundle. */
export function goldBundleFromUnitPrice(value: number): GoldBundle | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const hundredths = Math.round(value * 100);
  if (Math.abs(value * 100 - hundredths) > 1e-7) return null;
  if (hundredths === 0) return { totalSeptims: 0, quantity: 1 };
  let numerator = hundredths;
  let denominator = 100;
  while (denominator > 1 && numerator % 2 === 0 && denominator % 2 === 0) { numerator /= 2; denominator /= 2; }
  while (denominator > 1 && numerator % 5 === 0 && denominator % 5 === 0) { numerator /= 5; denominator /= 5; }
  return { totalSeptims: numerator, quantity: denominator };
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
