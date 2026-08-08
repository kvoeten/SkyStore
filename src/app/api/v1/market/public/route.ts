import { NextResponse } from "next/server";
import { getPublicMarketOverview } from "@/lib/public-market";

export const dynamic = "force-dynamic";

export async function GET() {
  const overview = await getPublicMarketOverview();
  if (!overview) return NextResponse.json({ error: "public_snapshot_unavailable" }, { status: 503 });
  return NextResponse.json(overview);
}
