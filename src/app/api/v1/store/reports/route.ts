import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getReports } from "@/lib/services/staff-queries";
import { isStoreAccessFailure, selectStore } from "@/lib/services/store-access";

export const dynamic = "force-dynamic";
const date = z.coerce.date();
export async function GET(request: NextRequest) {
  const selected = await selectStore(request);
  if (isStoreAccessFailure(selected)) return NextResponse.json({ error: selected.error }, { status: selected.status });
  const now = new Date();
  const from = request.nextUrl.searchParams.get("from") ? date.safeParse(request.nextUrl.searchParams.get("from")) : { success: true as const, data: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  const to = request.nextUrl.searchParams.get("to") ? date.safeParse(request.nextUrl.searchParams.get("to")) : { success: true as const, data: now };
  if (!from.success || !to.success || from.data > to.data || to.data > now) return NextResponse.json({ error: "invalid_report_period" }, { status: 400 });
  return NextResponse.json({ storeId: selected.id, ...await getReports(selected.id, from.data, to.data) });
}
