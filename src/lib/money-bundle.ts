/** Represent a decimal gold value with the existing integer total/quantity
 * ledger columns. 0.25g becomes 1g for 4 items; 1.5g becomes 3g for 2. */
export function unitGoldBundle(value: number): { quantity: number; totalSeptims: number } | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 0.000001) return null;
  if (cents === 0) return { quantity: 1, totalSeptims: 0 };
  const gcd = (left: number, right: number): number => right ? gcd(right, left % right) : left;
  const divisor = gcd(cents, 100);
  return { quantity: 100 / divisor, totalSeptims: cents / divisor };
}
