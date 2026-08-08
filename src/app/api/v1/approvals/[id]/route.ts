import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/runtime";
import { approvals, auditEvents, observations, receipts, recipes, stockMovements } from "@/db/schema";
import { canAccessStore, getAccessContext, mayApprove } from "@/lib/authorization";

const decisionSchema = z.object({ decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(1_000).optional() });

export async function PATCH(request: NextRequest, contextValue: { params: Promise<{ id: string }> }) {
  const context = await getAccessContext();
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_decision", issues: parsed.error.issues }, { status: 400 });
  const { id } = await contextValue.params;
  const result = await db.transaction(async (tx) => {
    const [approval] = await tx.select().from(approvals).where(eq(approvals.id, id)).limit(1);
    if (!approval) throw new Error("approval_not_found");
    if (approval.decision !== "pending") throw new Error("approval_already_decided");
    if (approval.requestedBy === context.userId) throw new Error("self_approval_forbidden");
    const access = approval.storeId ? canAccessStore(context, approval.storeId) : undefined;
    if (context.globalRole !== "platform_admin" && !mayApprove(access)) throw new Error("approval_forbidden");

    if (approval.targetType === "receipt") {
      const [receipt] = await tx.select().from(receipts).where(and(eq(receipts.id, approval.targetId), eq(receipts.status, "pending"))).limit(1);
      if (!receipt) throw new Error("pending_receipt_not_found");
      if (receipt.storeId !== approval.storeId) throw new Error("approval_target_store_mismatch");
      const provisional = await tx.select().from(stockMovements).where(and(eq(stockMovements.receiptId, receipt.id), eq(stockMovements.kind, "receipt"), eq(stockMovements.state, "provisional")));
      if (parsed.data.decision === "approved") {
        for (const itemId of [...new Set(provisional.map((movement) => movement.itemId))].sort()) {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${receipt.storeId}:${itemId}`}))`);
        }
        for (const movement of provisional) {
          await tx.insert(stockMovements).values([
            { storeId: movement.storeId, itemId: movement.itemId, receiptId: receipt.id, kind: "approval_transfer", state: "provisional", quantityDelta: -movement.quantityDelta, createdBy: context.userId, reason: parsed.data.note },
            { storeId: movement.storeId, itemId: movement.itemId, receiptId: receipt.id, kind: "approval_transfer", state: "confirmed", quantityDelta: movement.quantityDelta, createdBy: context.userId, reason: parsed.data.note }
          ]);
        }
        await tx.update(receipts).set({ status: "approved", approvedBy: context.userId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(receipts.id, receipt.id));
      } else {
        for (const movement of provisional) await tx.insert(stockMovements).values({ storeId: movement.storeId, itemId: movement.itemId, receiptId: receipt.id, kind: "rejection_reversal", state: "provisional", quantityDelta: -movement.quantityDelta, createdBy: context.userId, reason: parsed.data.note });
        await tx.update(receipts).set({ status: "rejected", updatedAt: new Date() }).where(eq(receipts.id, receipt.id));
      }
    } else if (approval.targetType === "observation") {
      const [observation] = await tx.select({ storeId: observations.storeId }).from(observations).where(eq(observations.id, approval.targetId)).limit(1);
      if (!observation) throw new Error("approval_target_not_found");
      if (observation.storeId !== approval.storeId) throw new Error("approval_target_store_mismatch");
      await tx.update(observations).set({ approval: parsed.data.decision }).where(and(eq(observations.id, approval.targetId), eq(observations.approval, "pending")));
    } else if (approval.targetType === "recipe") {
      const [recipe] = await tx.select({ storeId: recipes.storeId }).from(recipes).where(eq(recipes.id, approval.targetId)).limit(1);
      if (!recipe) throw new Error("approval_target_not_found");
      if (recipe.storeId !== approval.storeId) throw new Error("approval_target_store_mismatch");
      await tx.update(recipes).set({ approval: parsed.data.decision }).where(and(eq(recipes.id, approval.targetId), eq(recipes.approval, "pending")));
    }

    await tx.update(approvals).set({ decision: parsed.data.decision, reviewedBy: context.userId, reviewedAt: new Date(), note: parsed.data.note }).where(eq(approvals.id, id));
    await tx.insert(auditEvents).values({ actorId: context.userId, storeId: approval.storeId, action: `${approval.targetType}.${parsed.data.decision}`, entityType: approval.targetType, entityId: approval.targetId, after: { approvalId: id, decision: parsed.data.decision } });
    return { id, targetType: approval.targetType, targetId: approval.targetId, decision: parsed.data.decision };
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "approval_failed";
    return { error: message };
  });
  if ("error" in result) {
    const status = result.error === "approval_not_found" || result.error === "pending_receipt_not_found" ? 404 : result.error === "approval_forbidden" || result.error === "self_approval_forbidden" ? 403 : 409;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
