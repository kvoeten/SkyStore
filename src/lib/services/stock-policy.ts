export type StockBalance = {
  /** Immutable ledger total. This can be negative when a sale was not yet reported as stock. */
  ledgerConfirmedStock: number;
  ledgerAvailableStock: number;
  /** User-facing inventory total. The shelf count never presents a negative quantity. */
  confirmedStock: number;
  provisionalStock: number;
  availableStock: number;
};

function numberOrZero(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * The movement ledger remains exact, including sales that exceed the last
 * reported stock count. Inventory is only a convenience snapshot, so its
 * visible on-hand values are floored at zero.
 */
export function mapStockBalance(confirmed: unknown, provisional: unknown): StockBalance {
  const ledgerConfirmedStock = numberOrZero(confirmed);
  const provisionalStock = numberOrZero(provisional);
  const ledgerAvailableStock = ledgerConfirmedStock + provisionalStock;
  return {
    ledgerConfirmedStock,
    ledgerAvailableStock,
    confirmedStock: Math.max(0, ledgerConfirmedStock),
    provisionalStock,
    availableStock: Math.max(0, ledgerAvailableStock)
  };
}

/** A receipt always posts a movement; sales are deliberately never stock-gated. */
export function receiptQuantityDelta(direction: "store_purchase" | "store_sale", quantity: number): number {
  return direction === "store_purchase" ? quantity : -quantity;
}
