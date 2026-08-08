import { mapStockBalance } from "./stock-policy";

export type StockRow = { itemId: string; displayName: string; stableKey: string; category: string; confirmed: unknown; provisional: unknown; lastTradeAt?: Date | null };
export function asNumber(value: unknown): number { const parsed = typeof value === "number" ? value : Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }

export function mapInventoryRow(row: StockRow) {
  return {
    itemId: row.itemId,
    stableKey: row.stableKey,
    displayName: row.displayName,
    category: row.category,
    ...mapStockBalance(row.confirmed, row.provisional),
    lastTradeAt: row.lastTradeAt?.toISOString() ?? null
  };
}

export type ReportLine = { itemId: string; direction: "store_purchase" | "store_sale"; quantity: number; totalSeptims: number; occurrenceAt: Date };
export type SalesReport = { salesSeptims: number; costOfGoodsSeptims: number; grossProfitSeptims: number; grossMargin: number | null; knownCostUnits: number; unknownCostUnits: number };

/** Moving-average COGS is derived from immutable approved receipt lines, never from current asking prices. */
export function calculateSalesReport(lines: readonly ReportLine[], from: Date, to: Date): SalesReport {
  const states = new Map<string, { quantity: number; cost: number }>();
  let salesSeptims = 0, costOfGoodsSeptims = 0, knownCostUnits = 0, unknownCostUnits = 0;
  for (const line of [...lines].sort((a, b) => a.occurrenceAt.getTime() - b.occurrenceAt.getTime())) {
    const state = states.get(line.itemId) ?? { quantity: 0, cost: 0 };
    if (line.direction === "store_purchase") { state.quantity += line.quantity; state.cost += line.totalSeptims; states.set(line.itemId, state); continue; }
    const inPeriod = line.occurrenceAt >= from && line.occurrenceAt <= to;
    if (inPeriod) salesSeptims += line.totalSeptims;
    if (state.quantity <= 0) { if (inPeriod) unknownCostUnits += line.quantity; continue; }
    const knownQuantity = Math.min(state.quantity, line.quantity);
    const unitCost = state.cost / state.quantity;
    const cost = knownQuantity * unitCost;
    if (inPeriod) { costOfGoodsSeptims += cost; knownCostUnits += knownQuantity; unknownCostUnits += line.quantity - knownQuantity; }
    state.quantity -= knownQuantity; state.cost -= cost; states.set(line.itemId, state);
  }
  const grossProfitSeptims = salesSeptims - costOfGoodsSeptims;
  return { salesSeptims, costOfGoodsSeptims, grossProfitSeptims, grossMargin: salesSeptims ? grossProfitSeptims / salesSeptims : null, knownCostUnits, unknownCostUnits };
}

export function mapApprovalSummary(targetType: string, target: { id: string; label: string; detail: string } | undefined) {
  return target ? { targetType, target } : { targetType, target: { id: null, label: "Unavailable target", detail: "The referenced record is missing or outside this store." } };
}
