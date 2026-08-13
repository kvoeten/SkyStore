import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/runtime";
import { auditEvents, catalogItems } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";
import { MARKET_CATEGORIES } from "@/lib/catalog/market-categories";

const categorySchema = z.object({ category: z.enum(MARKET_CATEGORIES.map((entry) => entry.slug) as [string, ...string[]]).nullable() }).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const access = await getAccessContext();
  if (!access) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (access.globalRole !== "platform_admin") return NextResponse.json({ error: "platform_admin_required" }, { status: 403 });
  const parsed = categorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_market_category", issues: parsed.error.issues }, { status: 400 });
  const { itemId } = await params;
  const [before] = await db.select({ marketCategory: catalogItems.marketCategory }).from(catalogItems).where(eq(catalogItems.id, itemId)).limit(1);
  if (!before) return NextResponse.json({ error: "catalog_item_not_found" }, { status: 404 });
  await db.transaction(async (tx) => {
    await tx.update(catalogItems).set({ marketCategory: parsed.data.category }).where(eq(catalogItems.id, itemId));
    await tx.insert(auditEvents).values({ actorId: access.userId, action: "catalog.item.market_category_updated", entityType: "catalog_item", entityId: itemId, before, after: { marketCategory: parsed.data.category } });
  });
  return NextResponse.json({ itemId, category: parsed.data.category });
}
