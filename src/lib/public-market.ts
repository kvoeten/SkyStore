import { desc, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/runtime";
import { catalogItems, delayedSnapshots } from "@/db/schema";
import { categoryIconPath } from "@/lib/catalog/category-icons";
import { collapseItemFamilies } from "@/lib/catalog/item-families";
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
  const imageRows = itemIds.size ? await db.select({
    id: catalogItems.id, name: catalogItems.displayName, category: catalogItems.category, editorId: catalogItems.editorId, recordType: catalogItems.recordType,
    craftSignature: sql<string | null>`(
      select string_agg(ri.item_id::text || ':' || ri.quantity::text, '|' order by ri.item_id::text)
      from recipes public_recipe join recipe_ingredients ri on ri.recipe_id = public_recipe.id
      where public_recipe.output_item_id = ${catalogItems.id} and public_recipe.approval = 'approved' and public_recipe.is_catalog_default = true
    )`
  })
    .from(catalogItems)
    .where(inArray(catalogItems.id, [...itemIds])) : [];
  const families = collapseItemFamilies(imageRows);
  const canonicalByItem = new Map(families.flatMap((family) => family.familyItemIds.map((id) => [id, family.id] as const)));
  const familyByCanonical = new Map(families.map((family) => [family.id, family]));
  const publicPayload: PublicSnapshotPayload = {
    ...latestPayload,
    official: collapseOfficial(latestPayload.official, canonicalByItem, familyByCanonical),
    estimates: collapseEstimates(latestPayload.estimates, canonicalByItem, familyByCanonical),
    hotItems: collapseHotItems(latestPayload.hotItems, canonicalByItem, familyByCanonical),
    allTimeFavorites: collapseFavorites(latestPayload.allTimeFavorites, canonicalByItem, familyByCanonical),
  };
  const images: Record<string, string> = {};
  for (const family of families) images[family.id] = categoryIconPath(family);
  const chronological = [...snapshots].reverse();
  const trends: Record<string, PublicTrend> = {};
  for (const family of families) {
    const points = chronological.map((snapshot) => {
      const content = payload(snapshot.payload);
      const values = family.familyItemIds.map((itemId) => priceFor(content, itemId)).filter((value): value is number => value != null);
      return { at: snapshot.snapshotDate.toISOString(), customerPays: values.length ? Math.max(...values) : null };
    }).filter((point) => point.customerPays != null);
    const values = points.map((point) => point.customerPays).filter((value): value is number => value != null);
    const previous = values.at(-2); const current = values.at(-1);
    const percent = previous != null && current != null && previous !== 0 ? ((current - previous) / previous) * 100 : null;
    trends[family.id] = { direction: percent == null ? "new" : Math.abs(percent) < 0.005 ? "flat" : percent > 0 ? "up" : "down", percent, points };
  }
  return { sourceCutoffAt: latest.sourceCutoffAt, generatedAt: latest.createdAt, checksum: latest.checksum, ...publicPayload, images, trends };
}

function collapseOfficial(entries: PublicOfficialRule[], canonical: Map<string, string>, families: Map<string, { familyName: string }>) {
  const grouped = new Map<string, PublicOfficialRule>();
  for (const entry of entries) {
    const itemId = canonical.get(entry.itemId) ?? entry.itemId;
    const next = { ...entry, itemId, name: families.get(itemId)?.familyName ?? entry.name };
    const current = grouped.get(itemId);
    if (!current || next.septims[1] / next.quantity[0] > current.septims[1] / current.quantity[0]) grouped.set(itemId, next);
  }
  return [...grouped.values()];
}

function collapseEstimates(entries: PublicEstimate[], canonical: Map<string, string>, families: Map<string, { familyName: string }>) {
  const grouped = new Map<string, PublicEstimate>();
  for (const entry of entries) {
    const itemId = canonical.get(entry.itemId) ?? entry.itemId;
    const next = { ...entry, itemId, name: families.get(itemId)?.familyName ?? entry.name };
    const current = grouped.get(itemId);
    if (!current || Number(next.upperQuartile ?? next.median ?? -1) > Number(current.upperQuartile ?? current.median ?? -1)) grouped.set(itemId, next);
  }
  return [...grouped.values()];
}

function collapseHotItems(entries: PublicHotItem[], canonical: Map<string, string>, families: Map<string, { familyName: string }>) {
  const grouped = new Map<string, PublicHotItem>();
  for (const entry of entries) {
    const itemId = canonical.get(entry.itemId) ?? entry.itemId;
    const current = grouped.get(itemId) ?? { ...entry, itemId, name: families.get(itemId)?.familyName ?? entry.name, unitsSold: 0, tradeCount: 0 };
    current.unitsSold += entry.unitsSold; current.tradeCount += entry.tradeCount; current.storeCount = Math.max(current.storeCount, entry.storeCount); grouped.set(itemId, current);
  }
  return [...grouped.values()].sort((left, right) => right.unitsSold - left.unitsSold).slice(0, 5);
}

function collapseFavorites(entries: PublicFavorite[], canonical: Map<string, string>, families: Map<string, { familyName: string }>) {
  const grouped = new Map<string, PublicFavorite>();
  for (const entry of entries) {
    const itemId = canonical.get(entry.itemId) ?? entry.itemId;
    const current = grouped.get(itemId) ?? { ...entry, itemId, name: families.get(itemId)?.familyName ?? entry.name, unitsTraded: 0, tradeCount: 0 };
    current.unitsTraded += entry.unitsTraded; current.tradeCount += entry.tradeCount; current.activeMonths = Math.max(current.activeMonths, entry.activeMonths); current.storeCount = Math.max(current.storeCount, entry.storeCount); grouped.set(itemId, current);
  }
  return [...grouped.values()].sort((left, right) => right.unitsTraded - left.unitsTraded).slice(0, 10);
}
