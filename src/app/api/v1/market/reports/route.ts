import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { submitPublicMarketReportCommand } from "@/db/commands";
import { db } from "@/db/runtime";
import { approvals, auditEvents, catalogItems, publicMarketReports, users } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";
import { getTailoringPriceFamily } from "@/lib/services/recipe-queries";

/**
 * A public contribution is never a receipt or an observation. Every one starts
 * pending, including reports from platform administrators, and only the
 * platform review endpoint can publish it as market evidence.
 */
export async function POST(request: NextRequest) {
  const context = await getAccessContext();
  const parsed = submitPublicMarketReportCommand.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_market_report", issues: parsed.error.issues }, { status: 400 });

  const command = parsed.data;
  const priceFamily = await getTailoringPriceFamily(command.itemId);
  const result = await db.transaction(async (tx) => {
    const [item] = await tx.select({ id: catalogItems.id }).from(catalogItems)
      .where(and(eq(catalogItems.id, command.itemId), eq(catalogItems.status, "active"))).limit(1);
    if (!item) throw new Error("catalog_item_not_found");

    const [contributor] = context ? await tx.select({ displayName: users.displayName, name: users.name }).from(users)
      .where(eq(users.id, context.userId)).limit(1) : [];
    const contributorDisplayName = contributor?.displayName ?? contributor?.name ?? "Anonymous visitor";

    const [report] = await tx.insert(publicMarketReports).values({
      itemId: priceFamily.canonicalItemId,
      quantity: command.quantity,
      totalSeptims: command.totalSeptims,
      locationType: "street_sale",
      note: command.note,
      submittedBy: context?.userId ?? null,
      contributorDisplayName,
      status: "pending"
    }).returning({ id: publicMarketReports.id, status: publicMarketReports.status, createdAt: publicMarketReports.createdAt });
    await tx.insert(approvals).values({ targetType: "public_market_report", targetId: report.id, requestedBy: context?.userId ?? null });
    await tx.insert(auditEvents).values({
      actorId: context?.userId ?? null,
      action: "public_market_report.submitted",
      entityType: "public_market_report",
      entityId: report.id,
      after: { itemId: priceFamily.canonicalItemId, submittedItemId: command.itemId, priceFamily: priceFamily.displayName, quantity: command.quantity, totalSeptims: command.totalSeptims, locationType: "street_sale", contributorDisplayName, authenticated: Boolean(context) }
    });
    return report;
  }).catch((error: unknown) => ({ error: error instanceof Error ? error.message : "market_report_failed" }));

  if ("error" in result) {
    const status = result.error === "catalog_item_not_found" ? 404 : 409;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: 201 });
}
