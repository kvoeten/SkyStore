/* eslint-disable react-hooks/error-boundaries -- the catch handles only the awaited database read. */
import { AppShell, PageHeading } from "@/components/app-shell";
import { resolveStaffPageStore, staffShellIdentity } from "@/components/staff-page-context";
import { formatGold } from "@/lib/money";
import { getReports } from "@/lib/services/staff-queries";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ storeId?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const store = await resolveStaffPageStore(params.storeId);
  if (!store) return <AppShell current="/reports"><div className="page"><section className="card empty"><h1>No store selected.</h1><p>You need store access to view sales and stock reporting.</p></section></div></AppShell>;

  const now = new Date();
  const from = params.from ? new Date(params.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to = params.to ? new Date(params.to) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to || to > now) {
    return <AppShell current="/reports" identity={staffShellIdentity(store)}><div className="page"><section className="card empty"><h1>Invalid report period.</h1><p>Choose a period ending now or earlier.</p></section></div></AppShell>;
  }

  try {
    const report = await getReports(store.id, from, to);
    const metrics = [
      ["Confirmed sales", formatGold(report.sales.salesSeptims), "Approved store-sale receipts"],
      ["Cost of goods", formatGold(report.sales.costOfGoodsSeptims), `${report.sales.knownCostUnits} units with known cost`],
      ["Gross profit", formatGold(report.sales.grossProfitSeptims), report.sales.grossMargin == null ? "No sales in period" : `${(report.sales.grossMargin * 100).toFixed(1)}% gross margin`],
      ["Cost coverage", `${report.sales.knownCostUnits} known`, `${report.sales.unknownCostUnits} sale units lack historic purchase cost`]
    ];
    const active = report.velocity.filter((item) => item.sold > 0);
    const slow = report.velocity.filter((item) => item.sold === 0).slice(0, 6);

    return <AppShell current="/reports" identity={staffShellIdentity(store)}><div className="page">
      <PageHeading eyebrow={`${store.name.toUpperCase()} · ${from.toLocaleDateString()}–${to.toLocaleDateString()}`} title={<>Sales, margin &amp; <em>stock velocity.</em></>}/>
      <div className="grid metrics">{metrics.map(([label, metric, detail]) => <article className="card" key={label}><p>{label}</p><b className="metric">{metric}</b><br/><small>{detail}</small></article>)}</div>
      <div className="grid two-col">
        <section className="panel"><p className="eyebrow">HOT ITEMS</p><h2>Trade velocity</h2>{active.length ? <><div className="chart" role="img" aria-label="Confirmed sales velocity">{active.slice(0, 12).map((item) => <i key={item.itemId} style={{ height: `${Math.max(8, Math.min(100, (item.velocity ?? 0) * 100))}%` }}/>)}</div><ul className="list">{active.slice(0, 5).map((item) => <li key={item.itemId}><span><b>{item.displayName}</b><br/><small>{item.sold} sold · {item.purchased} purchased</small></span><strong>{item.velocity?.toFixed(2)}×</strong></li>)}</ul></> : <div className="empty"><h2>No completed sales.</h2><p>Velocity appears once approved sales are recorded.</p></div>}<p className="fine">Velocity uses approved completed lines only. Pending transactions are excluded.</p></section>
        <section className="panel"><p className="eyebrow">SLOW ITEMS</p><h2>No sales in period</h2>{slow.length ? <ul className="list">{slow.map((item) => <li key={item.itemId}><span><b>{item.displayName}</b><br/><small>{item.confirmedStock} confirmed on hand</small></span><strong>{item.lastTradeAt ? new Date(item.lastTradeAt).toLocaleDateString() : "No trade"}</strong></li>)}</ul> : <div className="empty"><h2>No slow stock.</h2><p>Every tracked item recorded a sale in this period.</p></div>}</section>
      </div>
    </div></AppShell>;
  } catch {
    return <AppShell current="/reports" identity={staffShellIdentity(store)}><div className="page"><section className="card empty"><h1>Reports unavailable.</h1><p>Please refresh and try again.</p></section></div></AppShell>;
  }
}
