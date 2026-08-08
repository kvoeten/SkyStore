import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/runtime";
import { approvals, auditEvents, receiptLines, receipts, stockMovements } from "@/db/schema";
import { createReceiptCommand } from "@/db/commands";
import { canAccessStore, getAccessContext, mayApprove } from "@/lib/authorization";
import { receiptQuantityDelta } from "@/lib/services/stock-policy";

export async function POST(request: NextRequest) {
  const context = await getAccessContext();
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = createReceiptCommand.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_receipt", issues: parsed.error.issues }, { status: 400 });
  const command = parsed.data;
  const access = canAccessStore(context, command.storeId);
  if (!access) return NextResponse.json({ error: "store_forbidden" }, { status: 403 });
  const approved = mayApprove(access);
  const result = await db.transaction(async (tx) => {
    const state: "confirmed" | "provisional" = approved ? "confirmed" : "provisional";
    const status = approved ? "approved" : "pending";
    for (const itemId of [...new Set(command.lines.map((line) => line.itemId))].sort()) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${command.storeId}:${itemId}`}))`);
    }
    const [receipt] = await tx.insert(receipts).values({ storeId: command.storeId, direction: command.direction, status, occurrenceAt: new Date(), notes: command.notes, totalSeptims: command.lines.reduce((total, line) => total + line.totalSeptims, 0), submittedBy: context.userId, approvedBy: approved ? context.userId : undefined, approvedAt: approved ? new Date() : undefined }).returning({ id: receipts.id, status: receipts.status });
    await tx.insert(receiptLines).values(command.lines.map((line, sequence) => ({ receiptId: receipt.id, itemId: line.itemId, quantity: line.quantity, totalSeptims: line.totalSeptims, sequence })));
    await tx.insert(stockMovements).values(command.lines.map((line) => ({ storeId: command.storeId, itemId: line.itemId, receiptId: receipt.id, kind: "receipt" as const, state, quantityDelta: receiptQuantityDelta(command.direction, line.quantity), createdBy: context.userId })));
    if (!approved) await tx.insert(approvals).values({ storeId: command.storeId, targetType: "receipt", targetId: receipt.id, requestedBy: context.userId });
    await tx.insert(auditEvents).values({ actorId: context.userId, storeId: command.storeId, action: approved ? "receipt.approved" : "receipt.submitted", entityType: "receipt", entityId: receipt.id, after: { direction: command.direction, status, lineCount: command.lines.length } });
    return receipt;
  });
  return NextResponse.json(result, { status: 201 });
}
