import { desc, inArray, lte } from "drizzle-orm";
import { db } from "@/db/runtime";
import { catalogItems, delayedSnapshots } from "@/db/schema";
import { categoryIconPath } from "@/lib/catalog/category-icons";
import { publicSnapshotCutoff } from "@/lib/market";

export type PublicOfficialRule = { itemId: string; name: string; side: "customer_pays"; septims: [number, number]; quantity: [number, number] };
export type PublicEstimate = { itemId: string; name: string; side: "customer_pays"; median: number | null; lowerQuartile: number | null; upperQuartile: number | null; storeCount: number; signalCount?: number; newestEvidenceAt?: string | null };
export type PublicHotItem = { itemId: string; name: string; unitsSold: number; tradeCount: number; storeCount: number };
export type PublicFavorite = { itemId: string; name: string; unitsTraded: number; tradeCount: number; activeMonths: number; storeCount: number };
export type PublicSnapshotPayload = { policy?: Record<string, number>; official: PublicOfficialRule[]; estimates: PublicEstimate[]; hotItems: PublicHotItem[]; allTimeFavorites: PublicFavorite[] };
export type PublicTrendPoint = { at: string; customerPays: number | null };
export type PublicTrend = { direction: "up" | "down" | "flat" | "new"; percent: number | null; points: PublicTrendPoint[] };

function payload(value: unknown): PublicSnapshotPayload {
  const source = value && typeof value === "object" ? value as Partial<PublicSnapshotPayload> : {};
  return {
    policy: source.policy,
    // Older snapshots may have contained acquisition prices. Filter and reshape
    // them here as a defense-in-depth boundary for every public reader.
    official: Array.isArray(source.official) ? source.official.filter((entry): entry is PublicOfficialRule =>
      Boolean(entry) && typeof entry === "object" && (entry as { side?: unknown }).side === "customer_pays"
    ) : [],
    estimates: Array.isArray(source.estimates) ? source.estimates.filter((entry): entry is PublicEstimate =>
      Boolean(entry) && typeof entry === "object" && (entry as { side?: unknown }).side === "customer_pays"
    ).map((entry) => {
      const legacy = entry as PublicEstimate & { confidence?: unknown };
      const { confidence, ...publicEntry } = legacy;
      void confidence;
      return publicEntry;
    }) : [],
    hotItems: Array.isArray(source.hotItems) ? source.hotItems : [],
    allTimeFavorites: Array.isArray(source.allTimeFavorites) ? source.allTimeFavorites : []
  };
}

function priceFor(snapshot: PublicSnapshotPayload, itemId: string): number | null {
  const estimate = snapshot.estimates.find((entry) => entry.itemId === itemId);
  if (estimate?.upperQuartile != null) return Number(estimate.upperQuartile);
  if (estimate?.median != null) return Number(estimate.median);
  const official = snapshot.official.find((entry) => entry.itemId === itemId);
  if (!official) return null;
  const septims = Number(official.septims[1]);
  const quantity = Number(official.quantity[0]);
  return quantity > 0 ? septims / quantity : null;
}

export async function getPublicMarketOverview(limit = 31) {
  const cutoff = publicSnapshotCutoff();
  const snapshots = await db.select().from(delayedSnapshots)
    .where(lte(delayedSnapshots.sourceCutoffAt, cutoff))
    .orderBy(desc(delayedSnapshots.snapshotDate)).limit(limit);
  const latest = snapshots[0];
  if (!latest) return null;
  const latestPayload = payload(latest.payload);
  const itemIds = new Set([...latestPayload.official, ...latestPayload.estimates].map((entry) => entry.itemId));
  const imageRows = itemIds.size ? await db.select({ itemId: catalogItems.id, name: catalogItems.displayName, category: catalogItems.category, editorId: catalogItems.editorId })
    .from(catalogItems)
    .where(inArray(catalogItems.id, [...itemIds])) : [];
  const images: Record<string, string> = {};
  for (const item of imageRows) images[item.itemId] = categoryIconPath(item);
  const chronological = [...snapshots].reverse();
  const trends: Record<string, PublicTrend> = {};
  for (const itemId of itemIds) {
    const points = chronological.map((snapshot) => {
      const content = payload(snapshot.payload);
      return { at: snapshot.snapshotDate.toISOString(), customerPays: priceFor(content, itemId) };
    }).filter((point) => point.customerPays != null);
    const values = points.map((point) => point.customerPays).filter((value): value is number => value != null);
    const previous = values.at(-2); const current = values.at(-1);
    const percent = previous != null && current != null && previous !== 0 ? ((current - previous) / previous) * 100 : null;
    trends[itemId] = { direction: percent == null ? "new" : Math.abs(percent) < 0.005 ? "flat" : percent > 0 ? "up" : "down", percent, points };
  }
  return { sourceCutoffAt: latest.sourceCutoffAt, generatedAt: latest.createdAt, checksum: latest.checksum, ...latestPayload, images, trends };
}
