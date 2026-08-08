import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/runtime";
import { catalogAliases, catalogItems } from "@/db/schema";
import { categoryIconPath } from "@/lib/catalog/category-icons";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ items: [] });
  const pattern = `%${query}%`;
  const items = await db.select({ id: catalogItems.id, name: catalogItems.displayName, category: catalogItems.category, editorId: catalogItems.editorId })
    .from(catalogItems)
    .where(and(eq(catalogItems.status, "active"), or(
      ilike(catalogItems.displayName, pattern),
      ilike(catalogItems.editorId, pattern),
      sql`exists (select 1 from ${catalogAliases} where ${catalogAliases.itemId} = ${catalogItems.id} and ${catalogAliases.alias} ilike ${pattern})`
    )))
    .orderBy(asc(catalogItems.displayName))
    .limit(100);
  return NextResponse.json({ items: items.map((item) => ({ id: item.id, name: item.name, category: item.category, imageUrl: categoryIconPath(item) })) });
}
