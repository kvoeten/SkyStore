import { and, desc, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/runtime";
import { baseCostRules, catalogItems, delayedSnapshots, officialPriceRules, publicMarketReports } from "@/db/schema";
import { categoryIconPath } from "@/lib/catalog/category-icons";
import { collapseItemFamilies } from "@/lib/catalog/item-families";
import { isMarketItemDisplayable } from "@/lib/catalog/market-item-filter";
import { productGroupForItem } from "@/lib/catalog/product-groups";
import { DEFAULT_MARKET_REGION, marketRegion } from "@/lib/market/holds";
import { marketReferenceValue } from "@/lib/market/reference-value";

export type PublicOfficialRule = { itemId: string; name: string; side: "store_pays" | "customer_pays"; septims: [number, number]; quantity: [number, number]; effectiveFrom?: string; region?: string };
export type PublicBaseCostRule = { itemId: string; name: string; septims: number; quantity: number; effectiveFrom?: string };
export type PublicEstimate = { itemId: string; name: string; market: "street" | "store"; side: "store_pays" | "customer_pays"; median: number | null; lowerQuartile: number | null; upperQuartile: number | null; storeCount: number; signalCount?: number; newestEvidenceAt?: string | null };
export type PublicHotItem = { itemId: string; name: string; unitsSold: number; tradeCount: number; storeCount: number };
export type PublicFavorite = { itemId: string; name: string; unitsTraded: number; tradeCount: number; activeMonths: number; storeCount: number };
export type PublicSnapshotPayload = { policy?: Record<string, number>; official: PublicOfficialRule[]; baseCosts: PublicBaseCostRule[]; estimates: PublicEstimate[]; hotItems: PublicHotItem[]; allTimeFavorites: PublicFavorite[] };
export type PublicTrendPoint = { at: string; value: number | null; customerPays: number | null; storePays: number | null };
export type PublicTrend = { direction: "up" | "down" | "flat"; percent: number; points: PublicTrendPoint[] };

function payload(value: unknown): PublicSnapshotPayload {
  const source = value && typeof value === "object" ? value as Partial<PublicSnapshotPayload> : {};
  return {
    policy: source.policy,
    official: Array.isArray(source.official) ? source.official.filter((entry): entry is PublicOfficialRule =>
      Boolean(entry) && typeof entry === "object" && ["customer_pays", "store_pays"].includes(String((entry as { side?: unknown }).side))
    ) : [],
    baseCosts: Array.isArray(source.baseCosts) ? source.baseCosts.filter((entry): entry is PublicBaseCostRule =>
      Boolean(entry) && typeof entry === "object" && typeof (entry as { itemId?: unknown }).itemId === "string" && typeof (entry as { septims?: unknown }).septims === "number" && typeof (entry as { quantity?: unknown }).quantity === "number"
    ) : [],
    estimates: Array.isArray(source.estimates) ? source.estimates.filter((entry): entry is PublicEstimate =>
      Boolean(entry) && typeof entry === "object" && ["customer_pays", "store_pays"].includes(String((entry as { side?: unknown }).side))
    ).map((entry) => {
      const legacy = entry as PublicEstimate & { confidence?: unknown };
      const { confidence, ...publicEntry } = legacy;
      void confidence;
      return { ...publicEntry, market: legacy.market === "street" ? "street" : "store" };
    }) : [],
    hotItems: Array.isArray(source.hotItems) ? source.hotItems : [],
    allTimeFavorites: Array.isArray(source.allTimeFavorites) ? source.allTimeFavorites : []
  };
}

function priceFor(snapshot: PublicSnapshotPayload, itemId: string): number | null {
  const streetValue = snapshot.estimates.find((entry) => entry.itemId === itemId && entry.market === "street")?.median ?? null;
  const official = snapshot.official.find((entry) => entry.itemId === itemId && entry.side === "customer_pays");
  const officialCustomerPays = official && official.quantity[0] > 0 ? Number(official.septims[1]) / Number(official.quantity[0]) : null;
  const baseCost = snapshot.baseCosts.find((entry) => entry.itemId === itemId);
  const baseCostValue = baseCost && baseCost.quantity > 0 ? baseCost.septims / baseCost.quantity : null;
  const baseCostIsNewer = baseCostValue != null && (!official?.effectiveFrom || !baseCost?.effectiveFrom || Date.parse(baseCost.effectiveFrom) >= Date.parse(official.effectiveFrom));
  return streetValue ?? (baseCostIsNewer ? baseCostValue : officialCustomerPays ?? baseCostValue);
}

export async function getPublicMarketOverview(limit = 31) {
  const now = new Date();
  const [officialRows, baseCostRows, reportRows, snapshots] = await Promise.all([
    db.select({ itemId: officialPriceRules.itemId, name: catalogItems.displayName, side: officialPriceRules.side, minimum: officialPriceRules.minimumSeptims, maximum: officialPriceRules.maximumSeptims, quantity: officialPriceRules.quantity, maximumQuantity: officialPriceRules.maximumQuantity, effectiveFrom: officialPriceRules.effectiveFrom, createdAt: officialPriceRules.createdAt })
      .from(officialPriceRules).innerJoin(catalogItems, eq(officialPriceRules.itemId, catalogItems.id))
      .where(and(eq(catalogItems.status, "active"), lte(officialPriceRules.effectiveFrom, now)))
      .orderBy(desc(officialPriceRules.effectiveFrom), desc(officialPriceRules.createdAt)),
    db.select({ itemId: baseCostRules.itemId, name: catalogItems.displayName, septims: baseCostRules.totalSeptims, quantity: baseCostRules.quantity, effectiveFrom: baseCostRules.effectiveFrom, createdAt: baseCostRules.createdAt })
      .from(baseCostRules).innerJoin(catalogItems, eq(baseCostRules.itemId, catalogItems.id))
      .where(and(eq(catalogItems.status, "active"), lte(baseCostRules.effectiveFrom, now)))
      .orderBy(desc(baseCostRules.effectiveFrom), desc(baseCostRules.createdAt)),
    db.select({ itemId: publicMarketReports.itemId, name: catalogItems.displayName, side: publicMarketReports.side, locationType: publicMarketReports.locationType, quantity: publicMarketReports.quantity, totalSeptims: publicMarketReports.totalSeptims, sourceLocation: publicMarketReports.sourceLocation, occurrenceAt: publicMarketReports.occurrenceAt })
      .from(publicMarketReports).innerJoin(catalogItems, eq(publicMarketReports.itemId, catalogItems.id))
      .where(and(eq(catalogItems.status, "active"), eq(publicMarketReports.status, "approved"), isNull(publicMarketReports.quarantinedAt), gt(publicMarketReports.occurrenceAt, new Date(now.getTime() - 90 * 86400000))))
      .orderBy(desc(publicMarketReports.occurrenceAt)),
    db.select().from(delayedSnapshots).orderBy(desc(delayedSnapshots.snapshotDate)).limit(limit)
  ]);
  const marketOfficialRows = officialRows.filter(isMarketItemDisplayable);
  const marketBaseCostRows = baseCostRows.filter(isMarketItemDisplayable);
  const marketReportRows = reportRows.filter(isMarketItemDisplayable);
  const newestOfficial = new Map<string, typeof officialRows[number]>();
  for (const row of marketOfficialRows) {
    const key = `${row.itemId}:${row.side}`;
    if (!newestOfficial.has(key)) newestOfficial.set(key, row);
  }
  const estimatesByItem = new Map<string, typeof reportRows>();
  for (const report of marketReportRows) {
    const market = report.locationType === "street_sale" ? "street" : "store";
    const key = `${report.itemId}:${market}:${report.side}`;
    estimatesByItem.set(key, [...(estimatesByItem.get(key) ?? []), report]);
  }
  const newestReportRegion = new Map<string, string>();
  for (const row of marketReportRows) if (!newestReportRegion.has(row.itemId)) newestReportRegion.set(row.itemId, marketRegion(row.sourceLocation));
  const liveOfficial = [...newestOfficial.values()].map((row) => ({ itemId: row.itemId, name: row.name, side: row.side, septims: [row.minimum, row.maximum] as [number, number], quantity: [row.quantity, row.maximumQuantity] as [number, number], effectiveFrom: row.effectiveFrom.toISOString(), region: newestReportRegion.get(row.itemId) ?? DEFAULT_MARKET_REGION }));
  const newestBaseCost = new Map<string, typeof baseCostRows[number]>();
  for (const row of marketBaseCostRows) if (!newestBaseCost.has(row.itemId)) newestBaseCost.set(row.itemId, row);
  const liveBaseCosts = [...newestBaseCost.values()].map((row) => ({ itemId: row.itemId, name: row.name, septims: row.septims, quantity: row.quantity, effectiveFrom: row.effectiveFrom.toISOString() }));
  const liveEstimates: PublicEstimate[] = [...estimatesByItem.entries()].map(([key, reports]) => {
    const [itemId, market, side] = key.split(":") as [string, PublicEstimate["market"], PublicEstimate["side"]];
    const prices = reports.map((report) => report.totalSeptims / report.quantity).sort((left, right) => left - right);
    const middle = prices[Math.floor(prices.length / 2)] ?? null;
    return { itemId, name: reports[0]?.name ?? "Catalog item", market, side, median: middle, lowerQuartile: prices[Math.floor((prices.length - 1) * .25)] ?? null, upperQuartile: prices[Math.floor((prices.length - 1) * .75)] ?? null, storeCount: 0, signalCount: prices.length, newestEvidenceAt: reports[0]?.occurrenceAt.toISOString() ?? null };
  });
  const priorSnapshot = snapshots[0] ? payload(snapshots[0].payload) : { official: [], baseCosts: [], estimates: [], hotItems: [], allTimeFavorites: [] };
  const latestPayload: PublicSnapshotPayload = { ...priorSnapshot, policy: { delayDays: 0, windowDays: 90, recencyHalfLifeDays: 30 }, official: liveOfficial, baseCosts: liveBaseCosts, estimates: liveEstimates };
  const itemIds = new Set([...latestPayload.official, ...latestPayload.baseCosts, ...latestPayload.estimates].map((entry) => entry.itemId));
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
    baseCosts: collapseBaseCosts(latestPayload.baseCosts, canonicalByItem, familyByCanonical),
    estimates: collapseEstimates(latestPayload.estimates, canonicalByItem, familyByCanonical),
    hotItems: collapseHotItems(latestPayload.hotItems, canonicalByItem, familyByCanonical),
    allTimeFavorites: collapseFavorites(latestPayload.allTimeFavorites, canonicalByItem, familyByCanonical),
  };
  const images: Record<string, string> = {};
  for (const family of families) images[family.id] = categoryIconPath(family);
  const chronological = [...snapshots].reverse();
  const trends: Record<string, PublicTrend> = {};
  for (const family of families) {
    const history = marketOfficialRows.filter((row) => family.familyItemIds.includes(row.itemId)).sort((left, right) => left.effectiveFrom.getTime() - right.effectiveFrom.getTime());
    // Store purchase and sale references must remain distinct in the chart.
    // Only a store sale can establish a street-value reference; a store-buy
    // rule is plotted on its own line instead of lowering that value.
    const officialPoints = history.map((row) => row.side === "customer_pays"
      ? { at: row.effectiveFrom.toISOString(), value: row.maximum / row.quantity }
      : { at: row.effectiveFrom.toISOString(), [row.side]: row.maximum / row.quantity });
    // Base costs are the current street-value fallback. A source-backed base
    // cost must therefore also anchor the visible timeline; otherwise items
    // such as Quicksilver display a value card but an empty trend.
    const baseCostPoints = marketBaseCostRows
      .filter((row) => family.familyItemIds.includes(row.itemId))
      .map((row) => ({ at: row.effectiveFrom.toISOString(), value: row.septims / row.quantity }));
    const reportPoints = marketReportRows.filter((row) => family.familyItemIds.includes(row.itemId)).map((row) => row.locationType === "street_sale" ? { at: row.occurrenceAt.toISOString(), value: row.totalSeptims / row.quantity } : { at: row.occurrenceAt.toISOString(), [row.side]: row.totalSeptims / row.quantity });
    const snapshotPoints = chronological.map((snapshot) => {
      const content = payload(snapshot.payload);
      const values = family.familyItemIds.map((itemId) => priceFor(content, itemId)).filter((value): value is number => value != null);
      return { at: snapshot.snapshotDate.toISOString(), value: values.length ? Math.max(...values) : null };
    }).filter((point) => point.value != null);
    const points = [...officialPoints, ...baseCostPoints, ...reportPoints].sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
    const usablePoints = weeklyTrend(points.length ? points : snapshotPoints, now);
    const current = usablePoints.at(-1)?.value ?? null;
    const monthlyBaseline = usablePoints.at(-5)?.value ?? usablePoints.at(-2)?.value ?? current;
    const percent = current != null && monthlyBaseline != null && monthlyBaseline !== 0 ? ((current - monthlyBaseline) / monthlyBaseline) * 100 : 0;
    trends[family.id] = { direction: Math.abs(percent) < 0.005 ? "flat" : percent > 0 ? "up" : "down", percent, points: usablePoints };
  }
  return { sourceCutoffAt: now, generatedAt: now, checksum: "live", ...publicPayload, images, trends };
}

/** One point per ISO week. Multiple price reports in a week are averaged; the
 * latest known value is carried forward so a quiet market remains visibly flat. */
type RawTrendPoint = { at: string; value?: number | null; customer_pays?: number; store_pays?: number };

function weeklyTrend(points: RawTrendPoint[], now: Date): PublicTrendPoint[] {
  if (!points.length) return [];
  const weekStart = (value: Date) => {
    const at = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    const weekday = (at.getUTCDay() + 6) % 7;
    at.setUTCDate(at.getUTCDate() - weekday);
    return at;
  };
  const byWeek = new Map<string, { customerPays: number[]; storePays: number[]; value: number[] }>();
  for (const point of points) {
    const week = weekStart(new Date(point.at)).toISOString();
    const bucket = byWeek.get(week) ?? { customerPays: [], storePays: [], value: [] };
    if (point.customer_pays != null) bucket.customerPays.push(point.customer_pays);
    if (point.store_pays != null) bucket.storePays.push(point.store_pays);
    if (point.value != null) bucket.value.push(point.value);
    byWeek.set(week, bucket);
  }
  const first = weekStart(new Date(points[0].at));
  const currentWeek = weekStart(now);
  const start = new Date(Math.max(first.getTime(), currentWeek.getTime() - 12 * 7 * 86400000));
  const result: PublicTrendPoint[] = [];
  let customerPays: number | null = null;
  let storePays: number | null = null;
  let carriedValue: number | null = null;
  for (let week = new Date(start); week <= currentWeek; week.setUTCDate(week.getUTCDate() + 7)) {
    const at = week.toISOString();
    const values = byWeek.get(at);
    if (values?.customerPays.length) customerPays = values.customerPays.reduce((sum, value) => sum + value, 0) / values.customerPays.length;
    if (values?.storePays.length) storePays = values.storePays.reduce((sum, value) => sum + value, 0) / values.storePays.length;
    if (values?.value.length) carriedValue = values.value.reduce((sum, value) => sum + value, 0) / values.value.length;
    const value = marketReferenceValue({ streetValue: carriedValue });
    if (value != null) result.push({ at, value, customerPays, storePays });
  }
  if (result.length === 1) result.unshift({ ...result[0], at: new Date(new Date(result[0].at).getTime() - 7 * 86400000).toISOString() });
  return result;
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

function collapseBaseCosts(entries: PublicBaseCostRule[], canonical: Map<string, string>, families: Map<string, { familyName: string }>) {
  const grouped = new Map<string, PublicBaseCostRule>();
  for (const entry of entries) {
    const itemId = canonical.get(entry.itemId) ?? entry.itemId;
    const next = { ...entry, itemId, name: families.get(itemId)?.familyName ?? entry.name };
    const current = grouped.get(itemId);
    if (!current || next.septims / next.quantity > current.septims / current.quantity) grouped.set(itemId, next);
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
    if (!isMarketItemDisplayable(entry)) continue;
    const itemId = canonical.get(entry.itemId) ?? entry.itemId;
    const current = grouped.get(itemId) ?? { ...entry, itemId, name: families.get(itemId)?.familyName ?? entry.name, unitsSold: 0, tradeCount: 0 };
    current.unitsSold += entry.unitsSold; current.tradeCount += entry.tradeCount; current.storeCount = Math.max(current.storeCount, entry.storeCount); grouped.set(itemId, current);
  }
  return [...grouped.values()].sort((left, right) => right.unitsSold - left.unitsSold).slice(0, 5);
}

function collapseFavorites(entries: PublicFavorite[], canonical: Map<string, string>, families: Map<string, { familyName: string }>) {
  const grouped = new Map<string, PublicFavorite>();
  for (const entry of entries) {
    if (!isMarketItemDisplayable(entry)) continue;
    const itemId = canonical.get(entry.itemId) ?? entry.itemId;
    const current = grouped.get(itemId) ?? { ...entry, itemId, name: families.get(itemId)?.familyName ?? entry.name, unitsTraded: 0, tradeCount: 0 };
    current.unitsTraded += entry.unitsTraded; current.tradeCount += entry.tradeCount; current.activeMonths = Math.max(current.activeMonths, entry.activeMonths); current.storeCount = Math.max(current.storeCount, entry.storeCount); grouped.set(itemId, current);
  }
  return [...grouped.values()].sort((left, right) => right.unitsTraded - left.unitsTraded).slice(0, 10);
}
