import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/runtime";
import { catalogItems, publicMarketReports, users } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  const context = await getAccessContext();
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (context.globalRole !== "platform_admin") return NextResponse.json({ error: "platform_admin_required" }, { status: 403 });
  const status = request.nextUrl.searchParams.get("status");
  if (status && !["pending", "approved", "rejected"].includes(status)) return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  const reports = await db.select({
    id: publicMarketReports.id,
    itemId: publicMarketReports.itemId,
    itemName: catalogItems.displayName,
    quantity: publicMarketReports.quantity,
    totalSeptims: publicMarketReports.totalSeptims,
    locationType: publicMarketReports.locationType,
    note: publicMarketReports.note,
    status: publicMarketReports.status,
    contributorDisplayName: publicMarketReports.contributorDisplayName,
    contributorDiscordName: users.name,
    contributorDiscordId: users.discordId,
    submittedBy: publicMarketReports.submittedBy,
    createdAt: publicMarketReports.createdAt,
    reviewedAt: publicMarketReports.reviewedAt,
    reviewNote: publicMarketReports.reviewNote
  }).from(publicMarketReports).innerJoin(catalogItems, eq(publicMarketReports.itemId, catalogItems.id))
    .leftJoin(users, eq(publicMarketReports.submittedBy, users.id))
    .where(status ? and(eq(publicMarketReports.status, status as "pending" | "approved" | "rejected")) : undefined)
    .orderBy(desc(publicMarketReports.createdAt)).limit(200);
  return NextResponse.json({ reports });
}
