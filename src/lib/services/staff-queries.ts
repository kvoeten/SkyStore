import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/runtime";
import { approvals, catalogAliases, catalogImages, catalogItems, memberships, officialPriceRules, observations, publicMarketReports, receiptLines, receipts, recipeIngredients, recipes, stockMovements, users } from "@/db/schema";
import { categoryIconPath } from "@/lib/catalog/category-icons";
import { estimateMarket, recommendedMaximumPurchase, saleFloor, type MarketSignal } from "@/lib/market";
import { prioritizeMarketGuideRows } from "@/lib/market/guide-ranking";
import { formatGold, formatHighestUnitGold } from "@/lib/money";
import { asNumber, calculateSalesReport, mapApprovalSummary, mapInventoryRow, type ReportLine } from "./staff-mappers";
import { mapStockBalance } from "./stock-policy";

const confirmed = sql<string>`coalesce(sum(case when ${stockMovements.state} = 'confirmed' then ${stockMovements.quantityDelta} else 0 end), 0)`;
const provisional = sql<string>`coalesce(sum(case when ${stockMovements.state} = 'provisional' then ${stockMovements.quantityDelta} else 0 end), 0)`;

export async function getInventory(storeId: string, query = "", category?: string) {
  const filters = [eq(stockMovements.storeId, storeId)];
  if (query) filters.push(ilike(catalogItems.displayName, `%${query.slice(0, 120)}%`));
  if (category) filters.push(eq(catalogItems.category, category.slice(0, 80)));
  const rows = await db.select({ itemId: catalogItems.id, stableKey: catalogItems.stableKey, displayName: catalogItems.displayName, category: catalogItems.category, confirmed, provisional, lastTradeAt: sql<Date | null>`max(${stockMovements.createdAt})` })
    .from(stockMovements).innerJoin(catalogItems, eq(stockMovements.itemId, catalogItems.id)).where(and(...filters))
    .groupBy(catalogItems.id, catalogItems.stableKey, catalogItems.displayName, catalogItems.category).orderBy(catalogItems.displayName).limit(200);
  return rows.map(mapInventoryRow);
}

export async function getPrivateMarketGuide(storeId: string, query = "") {
  const now = new Date();
  const recentSince = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const nowSql = now.toISOString();
  const recentSinceSql = recentSince.toISOString();
  const trimmedQuery = query.trim().slice(0, 120);
  const pattern = `%${trimmedQuery}%`;
  const currentPriceExists = sql`exists (
    select 1 from ${officialPriceRules} guide_price
    where guide_price.item_id = ${catalogItems.id}
      and (guide_price.store_id is null or guide_price.store_id = ${storeId})
      and guide_price.effective_from <= ${nowSql}::timestamptz
      and (guide_price.effective_to is null or guide_price.effective_to >= ${nowSql}::timestamptz)
  )`;
  const recentSaleExists = sql`exists (
    select 1 from ${receiptLines} guide_line
    join ${receipts} guide_receipt on guide_receipt.id = guide_line.receipt_id
    join ${users} guide_user on guide_user.id = guide_receipt.submitted_by
    where guide_line.item_id = ${catalogItems.id}
      and guide_receipt.status = 'approved' and guide_receipt.direction = 'store_sale'
      and guide_receipt.occurrence_at >= ${recentSinceSql}::timestamptz
      and guide_user.quarantined_at is null
  )`;
  const searchFilter = or(
    ilike(catalogItems.displayName, pattern),
    ilike(catalogItems.editorId, pattern),
    sql`exists (select 1 from ${catalogAliases} where ${catalogAliases.itemId} = ${catalogItems.id} and ${catalogAliases.alias} ilike ${pattern})`
  );
  const candidates = await db.select({ itemId: catalogItems.id, displayName: catalogItems.displayName, category: catalogItems.category, editorId: catalogItems.editorId })
    .from(catalogItems)
    .where(and(eq(catalogItems.status, "active"), trimmedQuery ? searchFilter : or(currentPriceExists, recentSaleExists)))
    .orderBy(catalogItems.displayName)
    .limit(200);
  if (!candidates.length) return [];

  const itemIds = candidates.map((item) => item.itemId);
  const [rules, sales] = await Promise.all([
    db.select({ itemId: officialPriceRules.itemId, storeId: officialPriceRules.storeId, side: officialPriceRules.side, minimumSeptims: officialPriceRules.minimumSeptims, maximumSeptims: officialPriceRules.maximumSeptims, quantity: officialPriceRules.quantity, maximumQuantity: officialPriceRules.maximumQuantity, effectiveFrom: officialPriceRules.effectiveFrom })
      .from(officialPriceRules)
      .where(and(inArray(officialPriceRules.itemId, itemIds), or(isNull(officialPriceRules.storeId), eq(officialPriceRules.storeId, storeId)), lte(officialPriceRules.effectiveFrom, now), or(isNull(officialPriceRules.effectiveTo), gte(officialPriceRules.effectiveTo, now))))
      .orderBy(desc(officialPriceRules.effectiveFrom)),
    db.select({ itemId: receiptLines.itemId, occurrenceAt: receipts.occurrenceAt, quantity: receiptLines.quantity, totalSeptims: receiptLines.totalSeptims })
      .from(receiptLines)
      .innerJoin(receipts, eq(receiptLines.receiptId, receipts.id))
      .innerJoin(users, eq(receipts.submittedBy, users.id))
      .where(and(inArray(receiptLines.itemId, itemIds), eq(receipts.status, "approved"), eq(receipts.direction, "store_sale"), gte(receipts.occurrenceAt, recentSince), isNull(users.quarantinedAt)))
      .orderBy(desc(receipts.occurrenceAt))
  ]);

  const preferredRules = new Map<string, (typeof rules)[number]>();
  for (const rule of rules) {
    const key = `${rule.itemId}:${rule.side}`;
    const current = preferredRules.get(key);
    if (!current || (rule.storeId === storeId && current.storeId !== storeId)) preferredRules.set(key, rule);
  }
  const latestSales = new Map<string, (typeof sales)[number]>();
  const recentUnits = new Map<string, number>();
  for (const sale of sales) {
    if (!latestSales.has(sale.itemId)) latestSales.set(sale.itemId, sale);
    recentUnits.set(sale.itemId, (recentUnits.get(sale.itemId) ?? 0) + sale.quantity);
  }

  return prioritizeMarketGuideRows(candidates.map((item) => {
    const storePays = preferredRules.get(`${item.itemId}:store_pays`) ?? null;
    const customerPays = preferredRules.get(`${item.itemId}:customer_pays`) ?? null;
    const lastSale = latestSales.get(item.itemId) ?? null;
    return {
      ...item,
      name: item.displayName,
      imageUrl: categoryIconPath({ name: item.displayName, category: item.category, editorId: item.editorId }),
      storePays,
      customerPays,
      lastSale,
      hasPrice: Boolean(storePays || customerPays),
      lastSoldAt: lastSale?.occurrenceAt ?? null,
      recentUnitsSold: recentUnits.get(item.itemId) ?? 0
    };
  }));
}

async function getReportLines(storeId: string): Promise<ReportLine[]> {
  const rows = await db.select({ itemId: receiptLines.itemId, direction: receipts.direction, quantity: receiptLines.quantity, totalSeptims: receiptLines.totalSeptims, occurrenceAt: receipts.occurrenceAt })
    .from(receiptLines).innerJoin(receipts, eq(receiptLines.receiptId, receipts.id))
    .where(and(eq(receipts.storeId, storeId), eq(receipts.status, "approved"))).orderBy(receipts.occurrenceAt);
  return rows as ReportLine[];
}

export async function getDashboard(storeId: string) {
  const inventory = await getInventory(storeId);
  const [queue] = await db.select({ count: sql<string>`count(*)` }).from(approvals).where(and(eq(approvals.storeId, storeId), eq(approvals.decision, "pending")));
  const end = new Date(); const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const report = calculateSalesReport(await getReportLines(storeId), start, end);
  return {
    stock: { distinctItems: inventory.length, confirmedUnits: inventory.reduce((sum, item) => sum + item.confirmedStock, 0), provisionalUnits: inventory.reduce((sum, item) => sum + item.provisionalStock, 0), lowOrNegativeItems: inventory.filter((item) => item.confirmedStock <= 0).length },
    approvalsPending: asNumber(queue?.count), sales30Days: report, hotItems: inventory.filter((item) => item.lastTradeAt).sort((a, b) => (b.lastTradeAt ?? "").localeCompare(a.lastTradeAt ?? "")).slice(0, 5),
    alerts: inventory.filter((item) => item.confirmedStock <= 0).slice(0, 10)
  };
}

export async function getItemDetail(storeId: string, itemId: string, targetMarkupBps: number) {
  const now = new Date();
  const marketWindowStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const [item] = await db.select().from(catalogItems).where(eq(catalogItems.id, itemId)).limit(1);
  if (!item) return null;
  const [image] = await db.select({ url: catalogImages.url, isFallback: catalogImages.isFallback }).from(catalogImages).where(eq(catalogImages.itemId, itemId)).orderBy(sql`case when ${catalogImages.kind} = 'uesp' then 0 when ${catalogImages.kind} = 'skystore_category_art' then 1 else 2 end`, catalogImages.url).limit(1);
  const [stock] = await db.select({ confirmed, provisional }).from(stockMovements).where(and(eq(stockMovements.storeId, storeId), eq(stockMovements.itemId, itemId)));
  const history = await db.select({ id: receipts.id, direction: receipts.direction, occurrenceAt: receipts.occurrenceAt, quantity: receiptLines.quantity, totalSeptims: receiptLines.totalSeptims, status: receipts.status })
    .from(receiptLines).innerJoin(receipts, eq(receiptLines.receiptId, receipts.id)).where(and(eq(receipts.storeId, storeId), eq(receiptLines.itemId, itemId))).orderBy(desc(receipts.occurrenceAt)).limit(100);
  const priceRules = await db.select({ side: officialPriceRules.side, minimumSeptims: officialPriceRules.minimumSeptims, maximumSeptims: officialPriceRules.maximumSeptims, quantity: officialPriceRules.quantity, maximumQuantity: officialPriceRules.maximumQuantity, effectiveFrom: officialPriceRules.effectiveFrom, effectiveTo: officialPriceRules.effectiveTo, sourceLabel: officialPriceRules.sourceLabel })
    .from(officialPriceRules).where(and(eq(officialPriceRules.itemId, itemId), or(isNull(officialPriceRules.storeId), eq(officialPriceRules.storeId, storeId)), lte(officialPriceRules.effectiveFrom, now), or(isNull(officialPriceRules.effectiveTo), gte(officialPriceRules.effectiveTo, now))));
  // Private estimates use only approved evidence. Receipt I/O and independent
  // street observations deliberately remain in separate signal sets.
  const [receiptEvidence, streetEvidence, publicReportEvidence] = await Promise.all([
    db.select({ storeId: receipts.storeId, direction: receipts.direction, quantity: receiptLines.quantity, totalSeptims: receiptLines.totalSeptims, occurrenceAt: receipts.occurrenceAt })
      .from(receiptLines).innerJoin(receipts, eq(receiptLines.receiptId, receipts.id)).innerJoin(users, eq(receipts.submittedBy, users.id))
      .where(and(eq(receiptLines.itemId, itemId), eq(receipts.status, "approved"), gte(receipts.occurrenceAt, marketWindowStart), isNull(users.quarantinedAt))),
    db.select({ storeId: observations.storeId, side: observations.side, kind: observations.kind, quantity: observations.quantity, totalSeptims: observations.totalSeptims, occurrenceAt: observations.occurrenceAt, expiresAt: observations.expiresAt })
      .from(observations).innerJoin(users, eq(observations.submittedBy, users.id))
      .where(and(eq(observations.itemId, itemId), eq(observations.approval, "approved"), gte(observations.occurrenceAt, marketWindowStart), isNull(observations.quarantinedAt), isNull(users.quarantinedAt), or(isNull(observations.expiresAt), gte(observations.expiresAt, now)))),
    db.select({ locationType: publicMarketReports.locationType, quantity: publicMarketReports.quantity, totalSeptims: publicMarketReports.totalSeptims, occurrenceAt: publicMarketReports.createdAt })
      .from(publicMarketReports).innerJoin(users, eq(publicMarketReports.submittedBy, users.id))
      .where(and(eq(publicMarketReports.itemId, itemId), eq(publicMarketReports.status, "approved"), gte(publicMarketReports.createdAt, marketWindowStart), isNull(publicMarketReports.quarantinedAt), isNull(users.quarantinedAt)))
  ]);
  const receiptSignals: MarketSignal[] = receiptEvidence.map((entry) => ({
    itemId,
    storeId: entry.storeId,
    side: entry.direction === "store_purchase" ? "store_pays" : "customer_pays",
    kind: "receipt",
    quantity: entry.quantity,
    totalSeptims: entry.totalSeptims,
    occurrenceAt: entry.occurrenceAt,
    approved: true,
    quarantined: false
  }));
  const streetSignals: MarketSignal[] = streetEvidence.map((entry) => ({
    itemId,
    storeId: entry.storeId,
    // Street prices are undirected traded values. Normalize older side-labelled
    // observations into the same street-price set.
    side: "customer_pays",
    kind: entry.kind,
    quantity: entry.quantity,
    totalSeptims: entry.totalSeptims,
    occurrenceAt: entry.occurrenceAt,
    expiresAt: entry.expiresAt,
    approved: true,
    quarantined: false
  }));
  // Customer reports have no tenant or stock effect. Admin-approved reports of
  // a store sale support the private store-sale range; approved street reports
  // support only the distinct undirected street-price range.
  for (const entry of publicReportEvidence) {
    const signal: MarketSignal = {
      itemId,
      side: "customer_pays",
      kind: "direct_quote",
      quantity: entry.quantity,
      totalSeptims: entry.totalSeptims,
      occurrenceAt: entry.occurrenceAt,
      approved: true,
      quarantined: false
    };
    if (entry.locationType === "store_sale") receiptSignals.push(signal);
    else streetSignals.push(signal);
  }
  const privateSignals = {
    store: (["store_pays", "customer_pays"] as const).map((side) => estimateMarket(receiptSignals, itemId, side, now)),
    street: (["store_pays", "customer_pays"] as const).map((side) => estimateMarket(streetSignals, itemId, side, now))
  };
  const recipeRows = await db.select().from(recipes).where(and(eq(recipes.outputItemId, itemId), eq(recipes.approval, "approved"), or(eq(recipes.storeId, storeId), eq(recipes.isCatalogDefault, true))));
  const ingredients = recipeRows.length ? await db.select({ recipeId: recipeIngredients.recipeId, itemId: catalogItems.id, displayName: catalogItems.displayName, quantity: recipeIngredients.quantity }).from(recipeIngredients).innerJoin(catalogItems, eq(recipeIngredients.itemId, catalogItems.id)).where(inArray(recipeIngredients.recipeId, recipeRows.map((recipe) => recipe.id))) : [];
  const lastPurchase = history.find((entry) => entry.direction === "store_purchase" && entry.status === "approved") ?? null;
  const lastSale = history.find((entry) => entry.direction === "store_sale" && entry.status === "approved") ?? null;
  const effectiveCost = lastPurchase ? lastPurchase.totalSeptims / lastPurchase.quantity : null;
  const saleSignal = privateSignals.store[1];
  const expectedSale = saleSignal?.median == null ? null : asNumber(saleSignal.median);
  const targetMarkup = targetMarkupBps / 10_000;
  const stockBalance = mapStockBalance(stock?.confirmed, stock?.provisional);
  return {
    item, image: image ?? null, stock: { confirmed: stockBalance.confirmedStock, provisional: stockBalance.provisionalStock, available: stockBalance.availableStock, ledgerConfirmed: stockBalance.ledgerConfirmedStock, ledgerAvailable: stockBalance.ledgerAvailableStock }, history,
    lastPurchase, lastSale, officialRates: priceRules, privateSignals,
    recommendations: { effectiveCost, targetMarkup, saleFloor: effectiveCost == null ? null : saleFloor(effectiveCost, targetMarkup), maximumPurchase: recommendedMaximumPurchase(expectedSale, targetMarkup, null) },
    recipes: recipeRows.map((recipe) => ({ ...recipe, ingredients: ingredients.filter((ingredient) => ingredient.recipeId === recipe.id) }))
  };
}

export async function getApprovalQueue(storeId: string) {
  const queue = await db.select({ id: approvals.id, targetType: approvals.targetType, targetId: approvals.targetId, requestedBy: approvals.requestedBy, requestedAt: approvals.createdAt, requesterName: users.name, requesterDisplayName: memberships.displayName })
    .from(approvals).leftJoin(users, eq(approvals.requestedBy, users.id)).leftJoin(memberships, and(eq(memberships.storeId, storeId), eq(memberships.userId, approvals.requestedBy), isNull(memberships.revokedAt))).where(and(eq(approvals.storeId, storeId), eq(approvals.decision, "pending"))).orderBy(desc(approvals.createdAt)).limit(100);
  const receiptIds = queue.filter((entry) => entry.targetType === "receipt").map((entry) => entry.targetId);
  const observationIds = queue.filter((entry) => entry.targetType === "observation").map((entry) => entry.targetId);
  const recipeIds = queue.filter((entry) => entry.targetType === "recipe").map((entry) => entry.targetId);
  const [receiptTargets, observationTargets, recipeTargets] = await Promise.all([
    receiptIds.length ? db.select({ id: receipts.id, total: receipts.totalSeptims, direction: receipts.direction }).from(receipts).where(and(eq(receipts.storeId, storeId), inArray(receipts.id, receiptIds))) : [],
    observationIds.length ? db.select({ id: observations.id, total: observations.totalSeptims, quantity: observations.quantity, kind: observations.kind }).from(observations).where(and(eq(observations.storeId, storeId), inArray(observations.id, observationIds))) : [],
    recipeIds.length ? db.select({ id: recipes.id, outputItemId: recipes.outputItemId, outputYield: recipes.outputYield }).from(recipes).where(and(or(eq(recipes.storeId, storeId), eq(recipes.isCatalogDefault, true)), inArray(recipes.id, recipeIds))) : []
  ]);
  return queue.map((entry) => {
    const receipt = receiptTargets.find((target) => target.id === entry.targetId);
    const observation = observationTargets.find((target) => target.id === entry.targetId);
    const recipe = recipeTargets.find((target) => target.id === entry.targetId);
    const target = receipt ? { id: receipt.id, label: receipt.direction === "store_purchase" ? "Store purchase" : "Store sale", detail: `${formatGold(receipt.total)} total` } : observation ? { id: observation.id, label: observation.kind, detail: `${formatHighestUnitGold(observation.total, observation.quantity)} · ${observation.quantity} units` } : recipe ? { id: recipe.id, label: "Recipe", detail: `${recipe.outputYield} output` } : undefined;
    return { id: entry.id, requestedBy: entry.requestedBy, requesterName: entry.requesterName, requesterDisplayName: entry.requesterDisplayName, requestedAt: entry.requestedAt, ...mapApprovalSummary(entry.targetType, target) };
  });
}

export async function getReports(storeId: string, from: Date, to: Date) {
  const lines = await getReportLines(storeId);
  const sales = calculateSalesReport(lines, from, to);
  const inventory = await getInventory(storeId);
  const byItem = new Map<string, { purchased: number; sold: number }>();
  for (const line of lines) {
    if (line.occurrenceAt < from || line.occurrenceAt > to) continue;
    const row = byItem.get(line.itemId) ?? { purchased: 0, sold: 0 };
    if (line.direction === "store_purchase") row.purchased += line.quantity; else row.sold += line.quantity;
    byItem.set(line.itemId, row);
  }
  return { from: from.toISOString(), to: to.toISOString(), sales, velocity: inventory.map((item) => ({ ...item, purchased: byItem.get(item.itemId)?.purchased ?? 0, sold: byItem.get(item.itemId)?.sold ?? 0, velocity: item.confirmedStock > 0 ? (byItem.get(item.itemId)?.sold ?? 0) / item.confirmedStock : null })).sort((a, b) => (b.velocity ?? -1) - (a.velocity ?? -1)) };
}
