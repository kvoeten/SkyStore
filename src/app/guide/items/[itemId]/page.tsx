/* eslint-disable @next/next/no-img-element -- catalog image paths are validated during offline import. */
import { and, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell, Status } from "@/components/app-shell";
import { PublicMarketReportForm } from "@/components/public-market-report-form";
import { RecipeRequirements } from "@/components/recipe-requirements";
import { db } from "@/db/runtime";
import { catalogImages, catalogItems } from "@/db/schema";
import { formatGold, formatHighestUnitGold } from "@/lib/money";
import { getPublicMarketOverview, type PublicOfficialRule, type PublicTrendPoint } from "@/lib/public-market";
import { getCatalogRecipesForItem, getRecipesUsingItem, getTailoringPriceFamily } from "@/lib/services/recipe-queries";

export const dynamic = "force-dynamic";

function bundle(rule?: PublicOfficialRule) {
  if (!rule) return "Not yet priced";
  return formatHighestUnitGold(rule.septims[1], rule.quantity[0]);
}

function marketPrice(upper: number | null | undefined) {
  return upper == null ? "Not yet priced" : formatGold(Number(upper));
}

function line(points: PublicTrendPoint[]) {
  const values = points.map((point) => point.customerPays).filter((value): value is number => value != null);
  if (values.length < 2) return null;
  const minimum = Math.min(...values); const maximum = Math.max(...values); const spread = maximum - minimum || 1;
  return points.flatMap((point, index) => {
    if (point.customerPays == null) return [];
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 92 - ((point.customerPays - minimum) / spread) * 78;
    return [`${x.toFixed(2)},${y.toFixed(2)}`];
  }).join(" ");
}

export default async function PublicItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const parsed = z.string().uuid().safeParse((await params).itemId); if (!parsed.success) notFound();
  const itemId = parsed.data;
  const priceFamilyPromise = getTailoringPriceFamily(itemId);
  const itemRecipesPromise = priceFamilyPromise.then((priceFamily) => getCatalogRecipesForItem(itemId, undefined, priceFamily));
  const [item, image, overview, itemRecipes, usedIn, priceFamily] = await Promise.all([
    db.select().from(catalogItems).where(and(eq(catalogItems.id, itemId), eq(catalogItems.status, "active"))).limit(1).then((rows) => rows[0]),
    db.select().from(catalogImages).where(eq(catalogImages.itemId, itemId)).orderBy(sql`case when ${catalogImages.kind} = 'render' then 0 when ${catalogImages.kind} = 'fallback' then 1 else 2 end`, catalogImages.url).limit(1).then((rows) => rows[0]),
    getPublicMarketOverview(),
    itemRecipesPromise,
    getRecipesUsingItem(itemId),
    priceFamilyPromise
  ]);
  if (!item) notFound();
  const familyIds = new Set(priceFamily.itemIds);
  const officialCustomer = overview?.official.filter((entry) => familyIds.has(entry.itemId)).sort((left, right) =>
    (right.septims[1] / right.quantity[0]) - (left.septims[1] / left.quantity[0]))[0];
  const estimateCustomer = overview?.estimates.filter((entry) => familyIds.has(entry.itemId)).sort((left, right) =>
    Number(right.upperQuartile ?? right.median ?? -1) - Number(left.upperQuartile ?? left.median ?? -1))[0];
  const trend = overview?.trends[priceFamily.canonicalItemId] ?? priceFamily.itemIds.map((familyItemId) => overview?.trends[familyItemId]).find(Boolean);
  const customerLine = line(trend?.points ?? []);
  const metadata = item.metadata as Record<string, unknown>; const description = typeof metadata.description === "string" ? metadata.description : null;
  return <AppShell current="/guide" publicView><div className="page"><p className="eyebrow"><a href="/guide">PRICE GUIDE</a> / {item.category.toUpperCase()}</p>
    <section className="item-hero panel"><div className="art">{image ? <img src={image.url} alt="" width="110" height="110"/> : "◇"}</div><div><p className="eyebrow">{item.recordType} · {item.stableKey}</p><h1>{item.displayName}</h1>{description && <p>{description}</p>}<div className="tags"><span>{item.category}</span>{item.editorId && <span>{item.editorId}</span>}{image?.isFallback && <span>Category artwork</span>}</div></div><div className="item-actions"><a className="button public-report-button" href="#market-report">REPORT PRICE</a><a className="outline" href="/guide">Back to prices</a></div></section>
    <div className="item-layout"><div className="stack"><section className="panel"><div className="panel-head"><div><p className="eyebrow">PUBLIC MARKET</p><h2>Store Price</h2></div></div><div className="grid rates"><article className="rate"><p>Published Store Price</p><b>{bundle(officialCustomer)}</b><small>Official reference</small></article><article className="rate"><p>Market Store Price</p><b>{marketPrice(estimateCustomer?.upperQuartile)}</b><small>Highest current delayed market rate</small></article></div><p className="market-footnote">Public price information can be up to 7 days behind on real market trends. Visit your local store for up-to-date pricing information.</p></section>
      <section className="panel"><div className="panel-head"><div><p className="eyebrow">DAILY SNAPSHOTS</p><h2>Price trend</h2></div>{trend && <Status kind={trend.direction === "down" ? "warn" : trend.direction === "up" ? "good" : "pending"}>{trend.percent == null ? "New" : `${trend.percent > 0 ? "+" : ""}${trend.percent.toFixed(1)}%`}</Status>}</div>{customerLine ? <><svg className="public-trend-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Delayed Store Price history for ${item.displayName}`}><polyline className="customer-line" points={customerLine}/></svg><div className="chart-legend"><span className="customer">Store Price</span></div></> : <div className="empty"><h2>First snapshot recorded.</h2><p>A trend will appear after prices exist in at least two public snapshots.</p></div>}</section>
      <PublicMarketReportForm itemId={priceFamily.canonicalItemId} itemName={priceFamily.displayName} appliesToCount={priceFamily.itemIds.length}/>
      {itemRecipes.length ? itemRecipes.map((recipe) => <section className="panel" key={recipe.id}><div className="panel-head"><div><p className="eyebrow">CRAFTING RECIPE</p><h2>{item.displayName}</h2></div><Status kind="pending">{[recipe.profession, recipe.masteryTier].filter(Boolean).join(" · ")}</Status></div><div className="recipe"><span>{recipe.ingredients.map((ingredient) => <Link key={ingredient.itemId} href={`/guide/items/${ingredient.itemId}`}>{ingredient.name} × {ingredient.quantity}<br/></Link>)}</span><b>→</b><span>{item.displayName} × {recipe.outputYield}</span><strong>Material cost: {recipe.materialCost == null ? "Incomplete" : formatGold(recipe.materialCost)}<br/>Product price: {recipe.productPrice == null ? "Not priced" : formatGold(recipe.productPrice)}</strong></div><RecipeRequirements requirements={recipe.requirements}/></section>) : <section className="panel"><div className="panel-head"><div><p className="eyebrow">CRAFTING</p><h2>Used in</h2></div><Status kind={usedIn.length ? "good" : "pending"}>{usedIn.length} recipes</Status></div>{usedIn.length ? <div className="table-wrap"><table className="used-in-list"><thead><tr><th>Craftable item</th><th>Amount used</th><th>Profession</th></tr></thead><tbody>{usedIn.map((recipe) => <tr key={recipe.id}><td><Link href={`/guide/items/${recipe.outputItemId}`}>{recipe.outputName}</Link><small>{recipe.masteryTier ?? "Mastery not encoded"}</small><RecipeRequirements requirements={recipe.requirements}/></td><td>{recipe.quantityUsed}</td><td>{recipe.profession}</td></tr>)}</tbody></table></div> : <div className="empty compact-empty"><h3>No known crafting use.</h3><p>This item is not part of an active Keizaal profession recipe.</p></div>}</section>}
    </div><aside className="stack"><section className="card"><p className="eyebrow">CATALOG DETAILS</p><dl className="public-item-meta"><div><dt>Plugin</dt><dd>{item.plugin ?? "Manual"}</dd></div><div><dt>Form ID</dt><dd>{item.localFormId ?? "—"}</dd></div><div><dt>Editor ID</dt><dd>{item.editorId ?? "—"}</dd></div><div><dt>Game value</dt><dd>{item.value ?? "—"}</dd></div><div><dt>Weight</dt><dd>{item.weight ?? "—"}</dd></div></dl></section></aside></div>
  </div></AppShell>;
}
