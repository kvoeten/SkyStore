import type { CreateReceiptCommand } from "@/db/commands";

export type PricedLine = CreateReceiptCommand["lines"][number] & { unitPrice: number };
export type CalculatedReceipt = { totalSeptims: number; itemCount: number; lines: PricedLine[] };

/** Integer septims are authoritative. Unit rates may be fractional (for example, 10 for 1). */
export function calculateReceipt(lines: CreateReceiptCommand["lines"]): CalculatedReceipt {
  if (lines.length === 0) throw new Error("A receipt requires at least one line.");
  const itemIds = new Set<string>();
  let totalSeptims = 0;
  let itemCount = 0;
  const priced = lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error("Receipt quantities must be positive integers.");
    if (!Number.isInteger(line.totalSeptims) || line.totalSeptims < 0) throw new Error("Receipt totals must be non-negative integer septims.");
    if (itemIds.has(line.itemId)) throw new Error("Duplicate receipt item; combine line quantities first.");
    itemIds.add(line.itemId);
    totalSeptims += line.totalSeptims;
    itemCount += line.quantity;
    return { ...line, unitPrice: line.totalSeptims / line.quantity };
  });
  return { totalSeptims, itemCount, lines: priced };
}

export type ReceiptStockInput = { direction: "store_purchase" | "store_sale"; status: "draft" | "pending" | "approved" | "rejected" | "voided"; lines: Array<{ itemId: string; quantity: number }> };
export type ProjectedMovement = { itemId: string; quantityDelta: number; bucket: "provisional" | "confirmed" };

/** Draft/rejected/voided receipts have no active movement: void is represented by immutable reversal rows in storage. */
export function projectReceiptMovements(receipt: ReceiptStockInput): ProjectedMovement[] {
  if (receipt.status !== "pending" && receipt.status !== "approved") return [];
  const sign = receipt.direction === "store_purchase" ? 1 : -1;
  const bucket = receipt.status === "pending" ? "provisional" : "confirmed";
  return receipt.lines.map((line) => ({ itemId: line.itemId, quantityDelta: sign * line.quantity, bucket }));
}

export type StoredMovement = { itemId: string; quantityDelta: number; state: "provisional" | "confirmed" };
export type StockBalance = { confirmed: number; provisional: number; available: number };

export function projectStock(movements: Iterable<StoredMovement>, itemId: string): StockBalance {
  let confirmed = 0;
  let provisional = 0;
  for (const movement of movements) {
    if (movement.itemId !== itemId) continue;
    if (movement.state === "confirmed") confirmed += movement.quantityDelta;
    else provisional += movement.quantityDelta;
  }
  return { confirmed, provisional, available: confirmed + provisional };
}

export type ReceiptTransition = {
  direction: ReceiptStockInput["direction"]; from: ReceiptStockInput["status"]; to: ReceiptStockInput["status"];
  lines: Array<{ itemId: string; quantity: number }>;
};
export type TransitionPosting = ProjectedMovement & { kind: "receipt" | "approval_transfer" | "rejection_reversal" | "void_reversal" };

/**
 * Creates append-only postings for legal lifecycle changes. Persist these in the same transaction
 * as the receipt status change; an approval moves units between buckets rather than double-counting.
 */
export function receiptTransitionPostings(change: ReceiptTransition): TransitionPosting[] {
  const sign = change.direction === "store_purchase" ? 1 : -1;
  const post = (quantity: number, bucket: "provisional" | "confirmed", kind: TransitionPosting["kind"]): TransitionPosting[] => change.lines.map((line) => ({ itemId: line.itemId, quantityDelta: sign * quantity * line.quantity, bucket, kind }));
  if (change.from === "draft" && change.to === "pending") return post(1, "provisional", "receipt");
  if (change.from === "draft" && change.to === "approved") return post(1, "confirmed", "receipt");
  if (change.from === "pending" && change.to === "approved") return [...post(-1, "provisional", "approval_transfer"), ...post(1, "confirmed", "approval_transfer")];
  if (change.from === "pending" && change.to === "rejected") return post(-1, "provisional", "rejection_reversal");
  if (change.from === "approved" && change.to === "voided") return post(-1, "confirmed", "void_reversal");
  throw new Error(`Illegal receipt transition: ${change.from} -> ${change.to}`);
}
