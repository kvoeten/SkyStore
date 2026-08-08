import { NextRequest, NextResponse } from "next/server";
import { getInventory } from "@/lib/services/staff-queries";
import { isStoreAccessFailure, selectStore } from "@/lib/services/store-access";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const selected = await selectStore(request);
  if (isStoreAccessFailure(selected)) return NextResponse.json({ error: selected.error }, { status: selected.status });
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const category = request.nextUrl.searchParams.get("category")?.trim() || undefined;
  return NextResponse.json({ storeId: selected.id, items: await getInventory(selected.id, query, category) });
}
