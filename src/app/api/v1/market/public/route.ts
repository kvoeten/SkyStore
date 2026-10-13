import { NextRequest, NextResponse } from "next/server";
import { getPublicMarketOverview } from "@/lib/public-market";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedIds = request.nextUrl.searchParams.get("itemIds")
    ?.split(",").filter((itemId) => /^[0-9a-f-]{36}$/i.test(itemId)).slice(0, 120);
  const overview = await getPublicMarketOverview({
    // The initial guide is intentionally a compact browse feed. Search sends
    // its matching catalog families, so it never needs a full-price dump.
    itemLimit: requestedIds?.length ? undefined : 80,
    itemIds: requestedIds?.length ? requestedIds : undefined,
  });
  if (!overview) return NextResponse.json({ error: "public_snapshot_unavailable" }, { status: 503 });
  return NextResponse.json(overview);
}
