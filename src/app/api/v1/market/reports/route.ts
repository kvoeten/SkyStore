import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { submitPublicMarketReportCommand } from "@/db/commands";
import { db } from "@/db/runtime";
import { approvals, auditEvents, catalogItems, publicMarketReports, users } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";

/**
 * A public contribution is never a receipt or an observation. Every one starts
 * pending, including reports from platform administrators, and only the
 * platform review endpoint can publish it as market evidence.
 */
export async function POST(request: NextRequest) {
  const context = await getAccessContext();
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = submitPublicMarketReportCommand.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_market_report", issues: parsed.error.issues }, { status: 400 });

  const command = parsed.data;
  const result = await db.transaction(async (tx) => {
    const [item] = await tx.select({ id: catalogItems.id }).from(catalogItems)
      .where(and(eq(catalogItems.id, command.itemId), eq(catalogItems.status, "active"))).limit(1);
    if (!item) throw new Error("catalog_item_not_found");

    const [contributor] = await tx.select({ displayName: users.displayName, name: users.name }).from(users)
      .where(eq(users.id, context.userId)).limit(1);
    const contributorDisplayName = command.displayName ?? contributor?.displayName ?? contributor?.name;
    if (!contributorDisplayName) throw new Error("display_name_required");
    if (command.displayName && command.displayName !== contributor?.displayName) {
      await tx.update(users).set({ displayName: command.displayName, updatedAt: new Date() }).where(eq(users.id, context.userId));
    }

    const [report] = await tx.insert(publicMarketReports).values({
      itemId: command.itemId,
      quantity: command.quantity,
      totalSeptims: command.totalSeptims,
      locationType: command.locationType,
      note: command.note,
      submittedBy: context.userId,
      contributorDisplayName,
      status: "pending"
    }).returning({ id: publicMarketReports.id, status: publicMarketReports.status, createdAt: publicMarketReports.createdAt });
    await tx.insert(approvals).values({ targetType: "public_market_report", targetId: report.id, requestedBy: context.userId });
    await tx.insert(auditEvents).values({
      actorId: context.userId,
      action: "public_market_report.submitted",
      entityType: "public_market_report",
      entityId: report.id,
      after: { itemId: command.itemId, quantity: command.quantity, totalSeptims: command.totalSeptims, locationType: command.locationType, contributorDisplayName }
    });
    return report;
  }).catch((error: unknown) => ({ error: error instanceof Error ? error.message : "market_report_failed" }));

  if ("error" in result) {
    const status = result.error === "catalog_item_not_found" ? 404 : result.error === "display_name_required" ? 400 : 409;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: 201 });
}
