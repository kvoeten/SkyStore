import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/authorization";
import { createManualCatalogItem, createManualCatalogItemCommand } from "@/lib/catalog/manual";

export async function POST(request: NextRequest) {
  const access = await getAccessContext();
  if (!access) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (access.globalRole !== "platform_admin") return NextResponse.json({ error: "platform_admin_required" }, { status: 403 });
  const parsed = createManualCatalogItemCommand.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_manual_catalog_item", issues: parsed.error.issues }, { status: 400 });
  return NextResponse.json(await createManualCatalogItem(parsed.data, access.userId), { status: 201 });
}
