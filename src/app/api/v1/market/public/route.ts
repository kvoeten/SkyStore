import { NextRequest, NextResponse } from "next/server";
import { getPublicMarketOverview } from "@/lib/public-market";

export const dynamic = "force-dynamic";

const responses = new Map<string, { expiresAt: number; value: Promise<Awaited<ReturnType<typeof getPublicMarketOverview>>> }>();

export async function GET(request: NextRequest) {
  const requestedIds = request.nextUrl.searchParams.get("itemIds")
    ?.split(",").filter((itemId) => /^[0-9a-f-]{36}$/i.test(itemId)).slice(0, 120);
  const highlights = request.nextUrl.searchParams.get("highlights") === "1";
  const key = highlights ? "highlights" : requestedIds?.length ? requestedIds.slice().sort().join(",") : "browse";
  let cached = responses.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    const value = getPublicMarketOverview({
    // The initial guide is intentionally a compact browse feed. Search sends
    // its matching catalog families, so it never needs a full-price dump.
    itemLimit: highlights || requestedIds?.length ? undefined : 80,
    itemIds: requestedIds?.length ? requestedIds : undefined,
    includeTrends: !highlights,
    });
    cached = { expiresAt: Date.now() + 15_000, value };
    if (responses.size >= 32) responses.delete(responses.keys().next().value!);
    responses.set(key, cached);
    void value.catch(() => { if (responses.get(key)?.value === value) responses.delete(key); });
  }
  const overview = await cached.value;
  if (!overview) return NextResponse.json({ error: "public_snapshot_unavailable" }, { status: 503 });
  if (highlights) {
    const featuredIds = new Set([...overview.hotItems, ...overview.allTimeFavorites].map((item) => item.itemId));
    const featuredNames = /^(?:(?:Petty|Common) Soul Gem|Leather|Spell Tome:.*|Mage Robes(?: Variant)?|Potion of Cure Disease|.* Arrow|Charcoal|Wheat|Common Clothes.*|Common Robes.*)$/i;
    const featured = (entry: { itemId: string; name: string }) => featuredIds.has(entry.itemId) || featuredNames.test(entry.name);
    return NextResponse.json({
      hotItems: overview.hotItems,
      allTimeFavorites: overview.allTimeFavorites,
      official: overview.official.filter(featured),
      estimates: overview.estimates.filter(featured),
    });
  }
  return NextResponse.json(overview);
}
