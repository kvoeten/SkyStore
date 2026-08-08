import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getItemDetail } from "@/lib/services/staff-queries";
import { isStoreAccessFailure, selectStore } from "@/lib/services/store-access";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  const selected = await selectStore(request);
  if (isStoreAccessFailure(selected)) return NextResponse.json({ error: selected.error }, { status: selected.status });
  const { itemId } = await context.params;
  if (!z.uuid().safeParse(itemId).success) return NextResponse.json({ error: "invalid_item_id" }, { status: 400 });
  const detail = await getItemDetail(selected.id, itemId, selected.targetMarkupBps);
  return detail ? NextResponse.json({ storeId: selected.id, ...detail }) : NextResponse.json({ error: "item_not_found" }, { status: 404 });
}
