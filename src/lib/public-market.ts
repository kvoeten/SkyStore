import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/runtime";
import { catalogItems, delayedSnapshots, officialPriceRules, publicMarketReports } from "@/db/schema";
import { categoryIconPath } from "@/lib/catalog/category-icons";
import { collapseItemFamilies } from "@/lib/catalog/item-families";
import { productGroupForItem } from "@/lib/catalog/product-groups";

export type PublicOfficialRule = { itemId: string; name: string; side: "store_pays" | "customer_pays"; septims: [number, number]; quantity: [number, number]; effectiveFrom?: string };
export type PublicEstimate = { itemId: string; name: string; side: "store_pays" | "customer_pays"; median: number | null; lowerQuartile: number | null; upperQuartile: number | null; storeCount: number; signalCount?: number; newestEvidenceAt?: string | null };
export type PublicHotItem = { itemId: string; name: string; unitsSold: number; tradeCount: number; storeCount: number };
export type PublicFavorite = { itemId: string; name: string; unitsTraded: number; tradeCount: number; activeMonths: number; storeCount: number };
export type PublicSnapshotPayload = { policy?: Record<string, number>; official: PublicOfficialRule[]; estimates: PublicEstimate[]; hotItems: PublicHotItem[]; allTimeFavorites: PublicFavorite[] };
export type PublicTrendPoint = { at: string; customerPays: number | null };
export type PublicTrend = { direction: "up" | "down" | "flat" | "new"; percent: number | null; points: PublicTrendPoint[] };

function payload(value: unknown): PublicSnapshotPayload {
  const source = value && typeof value === "object" ? value as Partial<PublicSnapshotPayload> : {};
  return {
    policy: source.policy,
    official: Array.isArray(source.official) ? source.official.filter((entry): entry is PublicOfficialRule =>
      Boolean(entry) && typeof entry === "object" && ["customer_pays", "store_pays"].includes(String((entry as { side?: unknown }).side))
    ) : [],
    estimates: Array.isArray(source.estimates) ? source.estimates.filter((entry): entry is PublicEstimate =>
      Boolean(entry) && typeof entry === "object" && ["customer_pays", "store_pays"].includes(String((entry as { side?: unknown }).side))
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
  const now = new Date();
  const [officialRows, reportRows, snapshots] = await Promise.all([
    db.select({ itemId: officialPriceRules.itemId, name: catalogItems.displayName, side: officialPriceRules.side, minimum: officialPriceRules.minimumSeptims, maximum: officialPriceRules.maximumSeptims, quantity: officialPriceRules.quantity, maximumQuantity: officialPriceRules.maximumQuantity, effectiveFrom: officialPriceRules.effectiveFrom, createdAt: officialPriceRules.createdAt })
      .from(officialPriceRules).innerJoin(catalogItems, eq(officialPriceRules.itemId, catalogItems.id))
      .where(and(eq(catalogItems.status, "active"), lte(officialPriceRules.effectiveFrom, now), or(isNull(officialPriceRules.effectiveTo), gt(officialPriceRules.effectiveTo, now))))
      .orderBy(desc(officialPriceRules.effectiveFrom), desc(officialPriceRules.createdAt)),
    db.select({ itemId: publicMarketReports.itemId, name: catalogItems.displayName, quantity: publicMarketReports.quantity, totalSeptims: publicMarketReports.totalSeptims, occurrenceAt: publicMarketReports.occurrenceAt })
      .from(publicMarketReports).innerJoin(catalogItems, eq(publicMarketReports.itemId, catalogItems.id))
      .where(and(eq(catalogItems.status, "active"), eq(publicMarketReports.status, "approved"), isNull(publicMarketReports.quarantinedAt), gt(publicMarketReports.occurrenceAt, new Date(now.getTime() - 90 * 86400000))))
      .orderBy(desc(publicMarketReports.occurrenceAt)),
    db.select().from(delayedSnapshots).orderBy(desc(delayedSnapshots.snapshotDate)).limit(limit)
  ]);
  const newestOfficial = new Map<string, typeof officialRows[number]>();
  for (const row of officialRows) {
    const key = `${row.itemId}:${row.side}`;
    if (!newestOfficial.has(key)) newestOfficial.set(key, row);
  }
  const estimatesByItem = new Map<string, typeof reportRows>();
  for (const report of reportRows) estimatesByItem.set(report.itemId, [...(estimatesByItem.get(report.itemId) ?? []), report]);
  const liveOfficial = [...newestOfficial.values()].map((row) => ({ itemId: row.itemId, name: row.name, side: row.side, septims: [row.minimum, row.maximum] as [number, number], quantity: [row.quantity, row.maximumQuantity] as [number, number], effectiveFrom: row.effectiveFrom.toISOString() }));
  const liveEstimates: PublicEstimate[] = [...estimatesByItem.entries()].map(([itemId, reports]) => {
    const prices = reports.map((report) => report.totalSeptims / report.quantity).sort((left, right) => left - right);
    const middle = prices[Math.floor(prices.length / 2)] ?? null;
    return { itemId, name: reports[0]?.name ?? "Catalog item", side: "customer_pays", median: middle, lowerQuartile: prices[Math.floor((prices.length - 1) * .25)] ?? null, upperQuartile: prices.at(-1) ?? null, storeCount: 0, signalCount: prices.length, newestEvidenceAt: reports[0]?.occurrenceAt.toISOString() ?? null };
  });
  const priorSnapshot = snapshots[0] ? payload(snapshots[0].payload) : { official: [], estimates: [], hotItems: [], allTimeFavorites: [] };
  const latestPayload: PublicSnapshotPayload = { ...priorSnapshot, policy: { delayDays: 0, windowDays: 90, recencyHalfLifeDays: 30 }, official: liveOfficial, estimates: liveEstimates };
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
  const families = collapseItemFamilies(imageRows.map((item) => {
    const group = productGroupForItem(item);
    return { ...item, productGroupKey: group?.key, productGroupLabel: group?.label };
  }));
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
    const history = officialRows.filter((row) => row.side === "customer_pays" && family.familyItemIds.includes(row.itemId)).sort((left, right) => left.effectiveFrom.getTime() - right.effectiveFrom.getTime());
    const officialPoints = history.map((row) => ({ at: row.effectiveFrom.toISOString(), customerPays: row.maximum / row.quantity }));
    const reportPoints = reportRows.filter((row) => family.familyItemIds.includes(row.itemId)).map((row) => ({ at: row.occurrenceAt.toISOString(), customerPays: row.totalSeptims / row.quantity }));
    const snapshotPoints = chronological.map((snapshot) => {
      const content = payload(snapshot.payload);
      const values = family.familyItemIds.map((itemId) => priceFor(content, itemId)).filter((value): value is number => value != null);
      return { at: snapshot.snapshotDate.toISOString(), customerPays: values.length ? Math.max(...values) : null };
    }).filter((point) => point.customerPays != null);
    const points = [...officialPoints, ...reportPoints].sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
    const usablePoints = points.length ? points : snapshotPoints;
    const values = usablePoints.map((point) => point.customerPays).filter((value): value is number => value != null);
    const previous = values.at(-2); const current = values.at(-1);
    const percent = previous != null && current != null && previous !== 0 ? ((current - previous) / previous) * 100 : null;
    trends[family.id] = { direction: percent == null ? "new" : Math.abs(percent) < 0.005 ? "flat" : percent > 0 ? "up" : "down", percent, points: usablePoints };
  }
  return { sourceCutoffAt: now, generatedAt: now, checksum: "live", ...publicPayload, images, trends };
}

function collapseOfficial(entries: PublicOfficialRule[], canonical: Map<string, string>, families: Map<string, { familyName: string }>) {
  const grouped = new Map<string, PublicOfficialRule>();
  for (const entry of entries) {
    const itemId = canonical.get(entry.itemId) ?? entry.itemId;
    const next = { ...entry, itemId, name: families.get(itemId)?.familyName ?? entry.name };
    const key = `${itemId}:${entry.side}`;
    const current = grouped.get(key);
    if (!current || next.septims[1] / next.quantity[0] > current.septims[1] / current.quantity[0]) grouped.set(key, next);
  }
  return [...grouped.values()];
}

function collapseEstimates(entries: PublicEstimate[], canonical: Map<string, string>, families: Map<string, { familyName: string }>) {
  const grouped = new Map<string, PublicEstimate>();
  for (const entry of entries) {
    const itemId = canonical.get(entry.itemId) ?? entry.itemId;
    const next = { ...entry, itemId, name: families.get(itemId)?.familyName ?? entry.name };
    const key = `${itemId}:${entry.side}`;
    const current = grouped.get(key);
    if (!current || Number(next.upperQuartile ?? next.median ?? -1) > Number(current.upperQuartile ?? current.median ?? -1)) grouped.set(key, next);
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
