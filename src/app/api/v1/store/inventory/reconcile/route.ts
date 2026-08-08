import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { stockReconciliationCommand } from "@/db/commands";
import { db } from "@/db/runtime";
import { auditEvents, stockMovements } from "@/db/schema";
import { isStoreAccessFailure, selectStore } from "@/lib/services/store-access";

export async function POST(request: NextRequest) {
  const store = await selectStore(request);
  if (isStoreAccessFailure(store)) return NextResponse.json({ error: store.error }, { status: store.status });
  const parsed = stockReconciliationCommand.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_stock_reconciliation", issues: parsed.error.issues }, { status: 400 });
  if (parsed.data.storeId !== store.id) return NextResponse.json({ error: "store_forbidden" }, { status: 403 });

  const result = await db.transaction(async (tx) => {
    // Receipt writers take this same lock. Reconciliation therefore measures
    // and corrects one coherent ledger position without blocking a sale on stock.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${store.id}:${parsed.data.itemId}`}))`);
    const [balance] = await tx.select({ quantity: sql<string>`coalesce(sum(${stockMovements.quantityDelta}), 0)` })
      .from(stockMovements)
      .where(and(eq(stockMovements.storeId, store.id), eq(stockMovements.itemId, parsed.data.itemId)));
    const ledgerAvailable = Number(balance?.quantity ?? 0);
    const quantityDelta = parsed.data.actualQuantity - ledgerAvailable;
    if (quantityDelta === 0) return { reconciled: false, actualQuantity: parsed.data.actualQuantity, ledgerAvailable, quantityDelta: 0 };

    const [movement] = await tx.insert(stockMovements).values({
      storeId: store.id,
      itemId: parsed.data.itemId,
      kind: "correction",
      state: "confirmed",
      quantityDelta,
      reason: parsed.data.note,
      createdBy: store.context.userId
    }).returning({ id: stockMovements.id });
    await tx.insert(auditEvents).values({
      actorId: store.context.userId,
      storeId: store.id,
      action: "stock.reconciled",
      entityType: "stock_movement",
      entityId: movement.id,
      after: { itemId: parsed.data.itemId, actualQuantity: parsed.data.actualQuantity, ledgerAvailableBefore: ledgerAvailable, quantityDelta }
    });
    return { reconciled: true, movementId: movement.id, actualQuantity: parsed.data.actualQuantity, ledgerAvailable, quantityDelta };
  });
  return NextResponse.json(result, { status: result.reconciled ? 201 : 200 });
}
