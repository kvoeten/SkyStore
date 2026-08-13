import { and, asc, eq, ilike, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/runtime";
import { catalogItems } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";
import { effectiveMarketCategory } from "@/lib/catalog/market-categories";

export async function GET(request: NextRequest) {
  const access = await getAccessContext();
  if (!access) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (access.globalRole !== "platform_admin") return NextResponse.json({ error: "platform_admin_required" }, { status: 403 });
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
  if (query.length < 2) return NextResponse.json({ items: [] });
  const pattern = `%${query}%`;
  const items = await db.select({ id: catalogItems.id, name: catalogItems.displayName, category: catalogItems.category, marketCategory: catalogItems.marketCategory, recordType: catalogItems.recordType, editorId: catalogItems.editorId })
    .from(catalogItems).where(and(eq(catalogItems.status, "active"), or(ilike(catalogItems.displayName, pattern), ilike(catalogItems.editorId, pattern))))
    .orderBy(asc(catalogItems.displayName)).limit(100);
  return NextResponse.json({ items: items.map((item) => ({ ...item, effectiveMarketCategory: effectiveMarketCategory(item) })) });
}
