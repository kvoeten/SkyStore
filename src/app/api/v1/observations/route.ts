import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/runtime";
import { approvals, auditEvents, observations } from "@/db/schema";
import { submitObservationCommand } from "@/db/commands";
import { canAccessStore, getAccessContext, mayApprove } from "@/lib/authorization";

export async function POST(request: NextRequest) {
  const context = await getAccessContext();
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = submitObservationCommand.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_observation", issues: parsed.error.issues }, { status: 400 });
  const command = parsed.data;
  const access = canAccessStore(context, command.storeId);
  if (!access) return NextResponse.json({ error: "store_forbidden" }, { status: 403 });
  const approved = mayApprove(access);
  const result = await db.transaction(async (tx) => {
    const [observation] = await tx.insert(observations).values({ ...command, side: "customer_pays", kind: "seen_listing", occurrenceAt: new Date(), approval: approved ? "approved" : "pending", submittedBy: context.userId }).returning({ id: observations.id, approval: observations.approval });
    if (!approved) await tx.insert(approvals).values({ storeId: command.storeId, targetType: "observation", targetId: observation.id, requestedBy: context.userId });
    await tx.insert(auditEvents).values({ actorId: context.userId, storeId: command.storeId, action: approved ? "observation.approved" : "observation.submitted", entityType: "observation", entityId: observation.id, after: { side: "customer_pays", kind: "seen_listing" } });
    return observation;
  });
  return NextResponse.json(result, { status: 201 });
}
