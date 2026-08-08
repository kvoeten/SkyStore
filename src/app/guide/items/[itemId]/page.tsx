/* eslint-disable @next/next/no-img-element -- catalog image paths are validated during offline import. */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell, Status } from "@/components/app-shell";
import { PublicMarketReportForm } from "@/components/public-market-report-form";
import { db } from "@/db/runtime";
import { catalogImages, catalogItems, recipeIngredients, recipes } from "@/db/schema";
import { formatGold, formatHighestUnitGold } from "@/lib/money";
import { getPublicMarketOverview, type PublicOfficialRule, type PublicTrendPoint } from "@/lib/public-market";

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
  const [item, image, overview, recipe] = await Promise.all([
    db.select().from(catalogItems).where(and(eq(catalogItems.id, itemId), eq(catalogItems.status, "active"))).limit(1).then((rows) => rows[0]),
    db.select().from(catalogImages).where(eq(catalogImages.itemId, itemId)).orderBy(sql`case when ${catalogImages.kind} = 'uesp' then 0 when ${catalogImages.kind} = 'skystore_category_art' then 1 else 2 end`, catalogImages.url).limit(1).then((rows) => rows[0]),
    getPublicMarketOverview(),
    db.select().from(recipes).where(and(eq(recipes.outputItemId, itemId), eq(recipes.approval, "approved"), eq(recipes.isCatalogDefault, true), isNull(recipes.storeId))).orderBy(desc(recipes.createdAt)).limit(1).then((rows) => rows[0])
  ]);
  if (!item) notFound();
  const ingredients = recipe ? await db.select({ itemId: catalogItems.id, name: catalogItems.displayName, quantity: recipeIngredients.quantity }).from(recipeIngredients).innerJoin(catalogItems, eq(recipeIngredients.itemId, catalogItems.id)).where(eq(recipeIngredients.recipeId, recipe.id)) : [];
  const officialCustomer = overview?.official.find((entry) => entry.itemId === itemId);
  const estimateCustomer = overview?.estimates.find((entry) => entry.itemId === itemId);
  const trend = overview?.trends[itemId]; const customerLine = line(trend?.points ?? []);
  const metadata = item.metadata as Record<string, unknown>; const description = typeof metadata.description === "string" ? metadata.description : null;
  return <AppShell current="/guide" publicView><div className="page"><p className="eyebrow"><a href="/guide">PRICE GUIDE</a> / {item.category.toUpperCase()}</p>
    <section className="item-hero panel"><div className="art">{image ? <img src={image.url} alt="" width="110" height="110"/> : "◇"}</div><div><p className="eyebrow">{item.recordType} · {item.stableKey}</p><h1>{item.displayName}</h1>{description && <p>{description}</p>}<div className="tags"><span>{item.category}</span>{item.editorId && <span>{item.editorId}</span>}{image?.isFallback && <span>Category artwork</span>}</div></div><div className="item-actions"><a className="button public-report-button" href="#market-report">REPORT PRICE</a><a className="outline" href="/guide">Back to prices</a></div></section>
    <div className="item-layout"><div className="stack"><section className="panel"><div className="panel-head"><div><p className="eyebrow">PUBLIC MARKET</p><h2>Store Price</h2></div></div><div className="grid rates"><article className="rate"><p>Published Store Price</p><b>{bundle(officialCustomer)}</b><small>Official reference</small></article><article className="rate"><p>Market Store Price</p><b>{marketPrice(estimateCustomer?.upperQuartile)}</b><small>Highest current delayed market rate</small></article></div><p className="market-footnote">Public price information can be up to 7 days behind on real market trends. Visit your local store for up-to-date pricing information.</p></section>
      <section className="panel"><div className="panel-head"><div><p className="eyebrow">DAILY SNAPSHOTS</p><h2>Price trend</h2></div>{trend && <Status kind={trend.direction === "down" ? "warn" : trend.direction === "up" ? "good" : "pending"}>{trend.percent == null ? "New" : `${trend.percent > 0 ? "+" : ""}${trend.percent.toFixed(1)}%`}</Status>}</div>{customerLine ? <><svg className="public-trend-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Delayed Store Price history for ${item.displayName}`}><polyline className="customer-line" points={customerLine}/></svg><div className="chart-legend"><span className="customer">Store Price</span></div></> : <div className="empty"><h2>First snapshot recorded.</h2><p>A trend will appear after prices exist in at least two public snapshots.</p></div>}</section>
      <PublicMarketReportForm itemId={itemId} itemName={item.displayName}/>
      {recipe && <section className="panel"><div className="panel-head"><div><p className="eyebrow">CATALOG RECIPE</p><h2>{item.displayName}</h2></div><Status kind="pending">{recipe.masteryTier ?? recipe.profession ?? "No profession mapping"}</Status></div><div className="recipe"><span>{ingredients.map((ingredient) => `${ingredient.name} × ${ingredient.quantity}`).join(" + ") || "No mapped ingredients"}</span><b>→</b><span>{item.displayName} × {recipe.outputYield}</span><strong>Labor fee: {formatGold(recipe.laborFee)}</strong></div></section>}
    </div><aside className="stack"><section className="card"><p className="eyebrow">CATALOG DETAILS</p><dl className="public-item-meta"><div><dt>Plugin</dt><dd>{item.plugin ?? "Manual"}</dd></div><div><dt>Form ID</dt><dd>{item.localFormId ?? "—"}</dd></div><div><dt>Editor ID</dt><dd>{item.editorId ?? "—"}</dd></div><div><dt>Game value</dt><dd>{item.value ?? "—"}</dd></div><div><dt>Weight</dt><dd>{item.weight ?? "—"}</dd></div></dl></section></aside></div>
  </div></AppShell>;
}
