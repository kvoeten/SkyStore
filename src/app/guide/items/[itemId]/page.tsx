/* eslint-disable @next/next/no-img-element -- catalog image paths are validated during offline import. */
import { and, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell, Status } from "@/components/app-shell";
import { PublicMarketReportForm } from "@/components/public-market-report-form";
import { MerchantPriceHelper } from "@/components/merchant-price-helper";
import { RecipeRequirements } from "@/components/recipe-requirements";
import { db } from "@/db/runtime";
import { catalogImages, catalogItems } from "@/db/schema";
import { formatGold, formatPurchaseGold, roundPurchaseGold } from "@/lib/money";
import { getPublicMarketOverview, type PublicTrendPoint } from "@/lib/public-market";
import { marketReferenceValue } from "@/lib/market/reference-value";
import { getCatalogRecipesForItem, getRecipesUsingItem, getTailoringPriceFamily } from "@/lib/services/recipe-queries";
import { getAccessContext } from "@/lib/authorization";

export const dynamic = "force-dynamic";

function trendLines(points: PublicTrendPoint[]) {
  const values = points.flatMap((point) => [point.value, point.customerPays, point.storePays]).filter((value): value is number => value != null);
  if (values.length < 2) return null;
  const minimum = Math.min(...values); const maximum = Math.max(...values); const spread = maximum - minimum || 1;
  const line = (key: "value" | "customerPays" | "storePays") => points.flatMap((point, index) => {
    const price = point[key]; if (price == null) return [];
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 92 - ((price - minimum) / spread) * 78;
    return [`${x.toFixed(2)},${y.toFixed(2)}`];
  }).join(" ");
  return { value: line("value"), customerPays: line("customerPays"), storePays: line("storePays") };
}

export default async function PublicItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const parsed = z.string().uuid().safeParse((await params).itemId); if (!parsed.success) notFound();
  const itemId = parsed.data;
  const priceFamilyPromise = getTailoringPriceFamily(itemId);
  const itemRecipesPromise = priceFamilyPromise.then((priceFamily) => getCatalogRecipesForItem(itemId, undefined, priceFamily));
  const [item, image, overview, itemRecipes, usedIn, priceFamily, access] = await Promise.all([
    db.select().from(catalogItems).where(and(eq(catalogItems.id, itemId), eq(catalogItems.status, "active"))).limit(1).then((rows) => rows[0]),
    db.select().from(catalogImages).where(eq(catalogImages.itemId, itemId)).orderBy(sql`case when ${catalogImages.kind} = 'render' then 0 when ${catalogImages.kind} = 'fallback' then 1 else 2 end`, catalogImages.url).limit(1).then((rows) => rows[0]),
    getPublicMarketOverview(), itemRecipesPromise, getRecipesUsingItem(itemId), priceFamilyPromise, getAccessContext().catch(() => null)
  ]);
  if (!item) notFound();
  const familyIds = new Set(priceFamily.itemIds);
  const officialCustomer = overview?.official.filter((entry) => entry.side === "customer_pays" && familyIds.has(entry.itemId)).sort((left, right) => (right.septims[1] / right.quantity[0]) - (left.septims[1] / left.quantity[0]))[0];
  const officialStore = overview?.official.filter((entry) => entry.side === "store_pays" && familyIds.has(entry.itemId)).sort((left, right) => (right.septims[1] / right.quantity[0]) - (left.septims[1] / left.quantity[0]))[0];
  const estimateStreet = overview?.estimates.filter((entry) => entry.market === "street" && familyIds.has(entry.itemId)).sort((left, right) => Number(right.median ?? -1) - Number(left.median ?? -1))[0];
  const estimateCustomer = overview?.estimates.filter((entry) => entry.market === "store" && entry.side === "customer_pays" && familyIds.has(entry.itemId)).sort((left, right) => Number(right.median ?? -1) - Number(left.median ?? -1))[0];
  const estimateStore = overview?.estimates.filter((entry) => entry.market === "store" && entry.side === "store_pays" && familyIds.has(entry.itemId)).sort((left, right) => Number(right.median ?? -1) - Number(left.median ?? -1))[0];
  const trend = overview?.trends[priceFamily.canonicalItemId] ?? priceFamily.itemIds.map((familyItemId) => overview?.trends[familyItemId]).find(Boolean);
  const lines = trendLines(trend?.points ?? []);
  const officialCustomerValue = officialCustomer ? officialCustomer.septims[1] / officialCustomer.quantity[0] : null;
  const reportedStreetValue = estimateStreet?.median == null ? null : Number(estimateStreet.median);
  const reportedCustomerValue = estimateCustomer?.median == null ? null : Number(estimateCustomer.median);
  const reportedStoreValue = estimateStore?.median == null ? null : Number(estimateStore.median);
  const value = marketReferenceValue({ streetValue: reportedStreetValue, officialCustomerPays: officialCustomerValue });
  const observedBuyingPrice = reportedStoreValue ?? (officialStore ? officialStore.septims[1] / officialStore.quantity[0] : null);
  const observedSellingPrice = reportedCustomerValue ?? officialCustomerValue;
  const buyTiers = value == null ? [] : [{ share: 50 }, { share: 70 }, { share: 90 }].map((tier) => ({ percent: tier.share - 100, price: roundPurchaseGold(value * tier.share / 100) }));
  const sellTiers = value == null ? [] : [0, 10, 30].map((percent) => ({ percent, price: Math.ceil(value * (1 + percent / 100)) }));
  const metadata = item.metadata as Record<string, unknown>; const description = typeof metadata.description === "string" ? metadata.description : null;
  return <AppShell current="/guide" publicView publicAccount={Boolean(access)} showAdmin={access?.globalRole === "platform_admin"}><div className="page"><p className="eyebrow"><a href="/guide">PRICE GUIDE</a> / {item.category.toUpperCase()}</p>
    <section className="item-hero panel"><div className="art">{image ? <img src={image.url} alt="" width="110" height="110"/> : "◇"}</div><div><p className="eyebrow">{item.recordType} · {item.stableKey}</p><h1>{item.displayName}</h1>{description && <p>{description}</p>}<div className="tags"><span>{item.category}</span>{item.editorId && <span>{item.editorId}</span>}{image?.isFallback && <span>Category artwork</span>}</div></div><div className="item-actions"><a className="button public-report-button" href="#market-report">REPORT PRICE</a><a className="outline" href="/guide">Back to prices</a></div></section>
    <div className="item-layout"><div className="stack">
      <section className="panel market-position"><div className="panel-head"><div><p className="eyebrow">MARKET POSITION</p><h2>Store pricing</h2></div><small>{officialCustomer?.region ?? "Whiterun"}</small></div><div className="price-ladders"><article className="price-ladder-card value-ladder"><p>Street value</p><b>{value == null ? "Not yet priced" : formatGold(value)}</b><small>{reportedStreetValue != null ? "Direct trade value" : "Published store reference until street value is reported"}</small></article><article className="price-ladder-card buying-ladder"><p>Store buying price</p><div>{buyTiers.map((tier) => <span className={`ladder-row tone-${Math.abs(tier.percent)}`} key={tier.percent}><strong>{tier.percent}%</strong><b>{formatPurchaseGold(tier.price)}</b><i aria-hidden="true"/></span>)}</div><small>{observedBuyingPrice == null ? "No buying price reported yet" : `Reported store buying price ${formatPurchaseGold(observedBuyingPrice)}`}</small></article><article className="price-ladder-card selling-ladder"><p>Store selling price</p><div>{sellTiers.map((tier) => <span className={`ladder-row tone-${tier.percent}`} key={tier.percent}><strong>+{tier.percent}%</strong><b>{formatGold(tier.price)}</b><i aria-hidden="true"/></span>)}</div><small>{observedSellingPrice == null ? "No selling price reported yet" : `Reported store selling price ${formatGold(observedSellingPrice)}`}</small></article></div>{value == null && <p className="market-footnote">Report a street value to generate whole-gold store buying and selling recommendations.</p>}</section>
      <section className="panel"><div className="panel-head"><div><p className="eyebrow">PRICE TIMELINE</p><h2>Weekly street value trend</h2></div>{trend && <Status kind={trend.direction === "down" ? "warn" : trend.direction === "up" ? "good" : "pending"}>{trend.percent > 0 ? "+" : ""}{trend.percent.toFixed(1)}%</Status>}</div>{lines ? <><svg className="public-trend-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Weekly street value history for ${item.displayName}`}><polyline className="value-line" points={lines.value}/>{lines.storePays && <polyline className="buy-line" points={lines.storePays}/>} {lines.customerPays && <polyline className="sale-line" points={lines.customerPays}/>}</svg><div className="chart-legend"><span className="value">Street value</span><span className="buy">Store buying prices</span><span className="sale">Store selling prices</span></div></> : <div className="empty"><h2>No value recorded.</h2><p>Report a street value to start this item’s weekly history.</p></div>}</section>
      <PublicMarketReportForm itemId={priceFamily.canonicalItemId} itemName={priceFamily.displayName} appliesToCount={priceFamily.itemIds.length}/>
      {itemRecipes.length ? itemRecipes.map((recipe) => <section className="panel" key={recipe.id}><div className="panel-head"><div><p className="eyebrow">CRAFTING RECIPE</p><h2>{item.displayName}</h2></div><Status kind="pending">{[recipe.profession, recipe.masteryTier].filter(Boolean).join(" · ")}</Status></div><div className="recipe"><span>{recipe.ingredients.map((ingredient) => <Link key={ingredient.itemId} href={`/guide/items/${ingredient.itemId}`}>{ingredient.name} × {ingredient.quantity}<br/></Link>)}</span><b>→</b><span>{item.displayName} × {recipe.outputYield}</span><strong>Material cost: {recipe.materialCost == null ? "Incomplete" : formatGold(recipe.materialCost)}<br/>Product price: {recipe.productPrice == null ? "Not priced" : formatGold(recipe.productPrice)}</strong></div><RecipeRequirements requirements={recipe.requirements}/></section>) : <section className="panel"><div className="panel-head"><div><p className="eyebrow">CRAFTING</p><h2>Used in</h2></div><Status kind={usedIn.length ? "good" : "pending"}>{usedIn.length} recipes</Status></div>{usedIn.length ? <div className="table-wrap"><table className="used-in-list"><thead><tr><th>Craftable item</th><th>Amount used</th><th>Profession</th></tr></thead><tbody>{usedIn.map((recipe) => <tr key={recipe.id}><td><Link href={`/guide/items/${recipe.outputItemId}`}>{recipe.outputName}</Link><small>{recipe.masteryTier ?? "Mastery not encoded"}</small><RecipeRequirements requirements={recipe.requirements}/></td><td>{recipe.quantityUsed}</td><td>{recipe.profession}</td></tr>)}</tbody></table></div> : <div className="empty compact-empty"><h3>No known crafting use.</h3><p>This item is not part of an active Keizaal profession recipe.</p></div>}</section>}
    </div><aside className="stack"><MerchantPriceHelper value={value}/><section className="card"><p className="eyebrow">CATALOG DETAILS</p><dl className="public-item-meta"><div><dt>Plugin</dt><dd>{item.plugin ?? "Manual"}</dd></div><div><dt>Form ID</dt><dd>{item.localFormId ?? "—"}</dd></div><div><dt>Editor ID</dt><dd>{item.editorId ?? "—"}</dd></div><div><dt>Game value</dt><dd>{item.value ?? "—"}</dd></div><div><dt>Weight</dt><dd>{item.weight ?? "—"}</dd></div></dl></section></aside></div>
  </div></AppShell>;
}
