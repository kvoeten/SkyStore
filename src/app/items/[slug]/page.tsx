/* eslint-disable react-hooks/error-boundaries, @next/next/no-img-element -- catalog images use administrator-validated local asset paths. */
import { notFound } from "next/navigation";
import { AppShell, Status } from "@/components/app-shell";
import { resolveStaffPageStore, staffShellIdentity } from "@/components/staff-page-context";
import { formatGold, formatHighestUnitGold } from "@/lib/money";
import { getItemDetail } from "@/lib/services/staff-queries";

export const dynamic = "force-dynamic";

const rate = (maximum: number, quantity: number) => formatHighestUnitGold(maximum, quantity);
const estimateRate = (estimate: { median: number | null; lowerQuartile: number | null; upperQuartile: number | null }) => {
  return formatGold(estimate.upperQuartile ?? estimate.median);
};
const evidenceNote = (estimate: { signalCount: number; newestEvidenceAt: Date | null }, empty: string) =>
  estimate.signalCount ? `${estimate.signalCount} approved entries${estimate.newestEvidenceAt ? ` · newest ${new Date(estimate.newestEvidenceAt).toLocaleDateString()}` : ""}` : empty;

export default async function ItemPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ storeId?: string; recorded?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const store = await resolveStaffPageStore(query.storeId);
  if (!store) {
    return <AppShell current="/inventory"><div className="page"><section className="card empty"><h1>No store selected.</h1><p>You need store access to view private item history.</p></section></div></AppShell>;
  }

  try {
    const detail = await getItemDetail(store.id, slug, store.targetMarkupBps);
    if (!detail) notFound();

    const metadata = detail.item.metadata as Record<string, unknown>;
    const description = typeof metadata.description === "string" ? metadata.description : "Catalog metadata is available for this item.";
    const storePays = detail.privateSignals.store[0];
    const customerPays = detail.privateSignals.store[1];
    const streetPrice = detail.privateSignals.street[1];
    const officialStorePays = detail.officialRates.find((entry) => entry.side === "store_pays");
    const officialCustomerPays = detail.officialRates.find((entry) => entry.side === "customer_pays");
    const history = detail.history.slice().reverse();
    const maxHistory = Math.max(...history.map((entry) => entry.totalSeptims / entry.quantity), 1);

    return <AppShell current="/inventory" identity={staffShellIdentity(store)}>
      <div className="page">
        <p className="eyebrow"><a href={`/inventory${store.storeQuery}`}>INVENTORY</a> / {detail.item.category.toUpperCase()} / ITEM RECORD</p>
        <section className="item-hero panel">
          <div className="art" aria-label={`${detail.item.displayName} artwork`}>
            {detail.image ? <img src={detail.image.url} alt="" width="110" height="110"/> : "◇"}
          </div>
          <div>
            <p className="eyebrow">{detail.item.recordType} · {detail.item.stableKey}</p>
            <h1>{detail.item.displayName}</h1>
            <p>{description}</p>
            <div className="tags"><span>{detail.item.category}</span>{detail.item.editorId && <span>Editor ID {detail.item.editorId}</span>}{detail.image?.isFallback && <span>Category artwork</span>}</div>
          </div>
          <div className="item-actions"><a className="button" href={`/record${store.storeQuery}&itemId=${encodeURIComponent(detail.item.id)}`}>Record a Sale</a></div>
        </section>
        {query.recorded && <div className="notice success"><b>{query.recorded === "pending" ? "Submitted for approval." : "Recorded."}</b><span>{detail.item.displayName} remains selected here.</span></div>}

        <div className="item-layout">
          <div className="stack">
            <section className="panel">
              <div className="panel-head">
                <div><p className="eyebrow">PRIVATE ALLIANCE MARKET</p><h2>Current trading prices</h2></div>
                <Status kind={customerPays.storeCount >= 3 ? "good" : "pending"}>{customerPays.storeCount} stores</Status>
              </div>
              <div className="grid rates">
                <article className="rate">
                  <p>Store buying price</p><b>{estimateRate(storePays)}</b>
                  <small>What stores have paid to acquire this item</small>
                  <small>{evidenceNote(storePays, "No approved store purchases")}</small>
                  {officialStorePays && <small>Official store buying price: {rate(officialStorePays.maximumSeptims, officialStorePays.quantity)}</small>}
                </article>
                <article className="rate">
                  <p>Store selling price</p><b>{estimateRate(customerPays)}</b>
                  <small>What customers have paid at stores</small>
                  <small>{evidenceNote(customerPays, "No approved store sales")}</small>
                  {officialCustomerPays && <small>Official store selling price: {rate(officialCustomerPays.maximumSeptims, officialCustomerPays.quantity)}</small>}
                </article>
                <article className="rate">
                  <p>Street price</p><b>{estimateRate(streetPrice)}</b>
                  <small>Value recorded during independent street trades</small>
                  <small>{evidenceNote(streetPrice, "No approved street prices")}</small>
                </article>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head"><div><p className="eyebrow">YOUR STORE</p><h2>Recommended store prices</h2></div></div>
              <div className="grid rates">
                <article className="rate"><p>Recommended store buying price</p><b>{formatGold(detail.recommendations.maximumPurchase)}</b><small>Offer up to this amount when buying from a customer</small></article>
                <article className="rate"><p>Recommended selling price</p><b>{formatGold(detail.recommendations.saleFloor)}</b><small>Charge at least this amount to keep the store&apos;s {(detail.recommendations.targetMarkup * 100).toFixed(0)}% target markup</small></article>
                <article className="rate"><p>Latest store buying price</p><b>{formatGold(detail.recommendations.effectiveCost)}</b><small>What this store paid in its latest approved purchase</small></article>
                <article className="rate"><p>Last store selling price</p><b>{detail.lastSale ? formatGold(detail.lastSale.totalSeptims / detail.lastSale.quantity) : "—"}</b><small>What the latest customer paid at this store</small></article>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head"><div><p className="eyebrow">YOUR STORE</p><h2>Receipt history</h2></div><Status>{history.length} entries</Status></div>
              {history.length ? <>
                <div className="chart" role="img" aria-label={`Approved receipt history for ${detail.item.displayName}`}>
                  {history.map((entry) => <i key={entry.id} style={{ height: `${Math.max(8, ((entry.totalSeptims / entry.quantity) / maxHistory) * 100)}%` }}/>)}
                </div>
                <div className="notice success"><b>{history.length} store receipt entries</b><span>Store purchases and customer sales only. Street reports are kept separate above.</span></div>
              </> : <div className="empty"><h2>No receipt history.</h2><p>Approved store trades will appear here.</p></div>}
            </section>

            {detail.recipes.map((recipe) => <section className="panel" key={recipe.id}>
              <div className="panel-head"><div><p className="eyebrow">CATALOG RECIPE</p><h2>{detail.item.displayName}</h2></div><Status kind="pending">{recipe.masteryTier ?? "No mastery tier"}</Status></div>
              <div className="recipe"><span>{recipe.ingredients.map((ingredient) => `${ingredient.displayName} × ${ingredient.quantity}`).join(" + ") || "No ingredients recorded"}</span><b>→</b><span>{detail.item.displayName} × {recipe.outputYield}</span><strong>Labor fee: {formatGold(recipe.laborFee)}</strong></div>
            </section>)}
          </div>
          <aside className="stack">
            <section className="card dark"><p className="eyebrow">YOUR SHELVES</p><h2>{detail.stock.confirmed} <small>confirmed</small></h2><p>◌ {detail.stock.provisional} pending approval</p><a href={`/inventory${store.storeQuery}`}>Open inventory →</a></section>
            <section className="card"><p className="eyebrow">CATALOG DETAILS</p><p>Value <b>{detail.item.value ?? "—"}</b></p><p>Weight <b>{detail.item.weight ?? "—"}</b></p><p>Last trade <b>{detail.history[0] ? new Date(detail.history[0].occurrenceAt).toLocaleDateString() : "—"}</b></p></section>
          </aside>
        </div>
      </div>
    </AppShell>;
  } catch {
    return <AppShell current="/inventory" identity={staffShellIdentity(store)}><div className="page"><section className="card empty"><h1>Item detail unavailable.</h1><p>Please return to inventory and try again.</p></section></div></AppShell>;
  }
}
