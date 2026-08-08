import { NextRequest, NextResponse } from "next/server";
import { getDashboard } from "@/lib/services/staff-queries";
import { isStoreAccessFailure, selectStore } from "@/lib/services/store-access";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const selected = await selectStore(request);
  if (isStoreAccessFailure(selected)) return NextResponse.json({ error: selected.error }, { status: selected.status });
  return NextResponse.json({ store: { id: selected.id, name: selected.name }, ...await getDashboard(selected.id) });
}
