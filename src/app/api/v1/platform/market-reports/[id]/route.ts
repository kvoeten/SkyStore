import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { reviewPublicMarketReportCommand } from "@/db/commands";
import { db } from "@/db/runtime";
import { approvals, auditEvents, jobs, publicMarketReports } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";

export async function PATCH(request: NextRequest, contextValue: { params: Promise<{ id: string }> }) {
  const context = await getAccessContext();
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (context.globalRole !== "platform_admin") return NextResponse.json({ error: "platform_admin_required" }, { status: 403 });
  const parsed = reviewPublicMarketReportCommand.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_market_report_decision", issues: parsed.error.issues }, { status: 400 });
  const { id } = await contextValue.params;

  const result = await db.transaction(async (tx) => {
    const [report] = await tx.select().from(publicMarketReports).where(eq(publicMarketReports.id, id)).limit(1);
    if (!report) throw new Error("market_report_not_found");
    if (report.status !== "pending") throw new Error("market_report_already_decided");
    const [approval] = await tx.select().from(approvals).where(and(
      eq(approvals.targetType, "public_market_report"),
      eq(approvals.targetId, report.id),
      eq(approvals.decision, "pending")
    )).limit(1);
    if (!approval) throw new Error("pending_approval_not_found");

    const reviewedAt = new Date();
    await tx.update(publicMarketReports).set({ status: parsed.data.decision, reviewedBy: context.userId, reviewedAt, reviewNote: parsed.data.note })
      .where(and(eq(publicMarketReports.id, report.id), eq(publicMarketReports.status, "pending")));
    await tx.update(approvals).set({ decision: parsed.data.decision, reviewedBy: context.userId, reviewedAt, note: parsed.data.note })
      .where(eq(approvals.id, approval.id));
    if (parsed.data.decision === "approved" && report.locationType === "store_sale") {
      await tx.insert(jobs).values({ kind: "market.public_snapshot", payload: { reason: "public_market_report_approved", reportId: report.id } });
    }
    await tx.insert(auditEvents).values({
      actorId: context.userId,
      action: `public_market_report.${parsed.data.decision}`,
      entityType: "public_market_report",
      entityId: report.id,
      after: { approvalId: approval.id, decision: parsed.data.decision, locationType: report.locationType }
    });
    return { id: report.id, status: parsed.data.decision };
  }).catch((error: unknown) => ({ error: error instanceof Error ? error.message : "market_report_review_failed" }));

  if ("error" in result) {
    const status = result.error === "market_report_not_found" ? 404 : 409;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
