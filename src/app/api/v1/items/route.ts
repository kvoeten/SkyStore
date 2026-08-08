import { and, asc, eq, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/runtime";
import { catalogItems } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  if (!await getAccessContext()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const selectedId = z.uuid().safeParse(request.nextUrl.searchParams.get("id")).data;
  const category = request.nextUrl.searchParams.get("category")?.trim();
  const filters = [eq(catalogItems.status, "active")];
  if (selectedId && !query) filters.push(eq(catalogItems.id, selectedId));
  if (query) filters.push(ilike(catalogItems.displayName, `%${query}%`));
  if (category) filters.push(eq(catalogItems.category, category));
  const items = await db.select({ id: catalogItems.id, stableKey: catalogItems.stableKey, displayName: catalogItems.displayName, category: catalogItems.category, recordType: catalogItems.recordType, plugin: catalogItems.plugin, localFormId: catalogItems.localFormId, value: catalogItems.value, weight: catalogItems.weight, metadata: catalogItems.metadata }).from(catalogItems).where(and(...filters)).orderBy(asc(catalogItems.displayName)).limit(50);
  return NextResponse.json({ items });
}
