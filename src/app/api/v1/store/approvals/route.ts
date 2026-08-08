import { NextRequest, NextResponse } from "next/server";
import { getApprovalQueue } from "@/lib/services/staff-queries";
import { isStoreAccessFailure, selectStore } from "@/lib/services/store-access";
import { mayApprove } from "@/lib/authorization";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const selected = await selectStore(request);
  if (isStoreAccessFailure(selected)) return NextResponse.json({ error: selected.error }, { status: selected.status });
  if (!mayApprove(selected.access)) return NextResponse.json({ error: "approval_queue_forbidden" }, { status: 403 });
  return NextResponse.json({ storeId: selected.id, approvals: await getApprovalQueue(selected.id) });
}
