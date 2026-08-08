/* eslint-disable react-hooks/error-boundaries -- the catch handles only the awaited database read. */
import { AppShell, PageHeading } from "@/components/app-shell";
import { resolveStaffPageStore, staffShellIdentity } from "@/components/staff-page-context";
import { formatGold } from "@/lib/money";
import { getDashboard } from "@/lib/services/staff-queries";

export const dynamic = "force-dynamic";

const amount = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ storeId?: string }> }) {
  const store = await resolveStaffPageStore((await searchParams).storeId);
  if (!store) {
    return <AppShell current="/dashboard"><div className="page"><section className="card empty"><h1>No store selected.</h1><p>You do not currently have access to a store ledger.</p></section></div></AppShell>;
  }

  try {
    const dashboard = await getDashboard(store.id);
    const metrics = [
      ["Current stock", amount(dashboard.stock.confirmedUnits), `${dashboard.stock.distinctItems} catalog items`],
      ["Pending change", amount(dashboard.stock.provisionalUnits), "Awaiting approval"],
      ["Sales · 30 days", formatGold(dashboard.sales30Days.salesSeptims), `${dashboard.sales30Days.knownCostUnits} costed units`],
      ["Review queue", String(dashboard.approvalsPending), "Pending submissions"]
    ];

    return <AppShell current="/dashboard" identity={staffShellIdentity(store)}><div className="page">
      <PageHeading eyebrow={store.name.toUpperCase()} title="Store ledger" actions={<a className="button" href={`/record${store.storeQuery}`}>Record a Sale</a>}>
        <p className="lede">A quick view of estimated stock, pending changes, and sales recorded for this store.</p>
      </PageHeading>
      <div className="grid metrics">{metrics.map(([label, value, detail]) => <article className="card" key={label}><p>{label}</p><b className="metric">{value}</b><br/><small>{detail}</small></article>)}</div>
      <div className="grid two-col">
        <section className="panel">
          <div className="panel-head"><div><p className="eyebrow">INVENTORY</p><h2>Items at zero</h2></div><a href={`/inventory${store.storeQuery}`}>View inventory →</a></div>
          {dashboard.alerts.length ? <ul className="list">{dashboard.alerts.map((item) => <li key={item.itemId}><span><b>{item.displayName}</b><br/><small>{item.confirmedStock} current · {item.provisionalStock} pending change</small></span><a className="text-button" href={`/items/${item.itemId}${store.storeQuery}`}>View item</a></li>)}</ul> : <div className="empty"><h2>No items at zero.</h2><p>Every tracked item currently has stock.</p></div>}
        </section>
        <section className="card dark">
          <div className="panel-head"><div><p className="eyebrow">RECENTLY TRADED</p><h2>Active items</h2></div><a href={`/approvals${store.storeQuery}`}>{dashboard.approvalsPending} pending</a></div>
          {dashboard.hotItems.length ? <ul className="list">{dashboard.hotItems.map((item) => <li key={item.itemId}><span><b>{item.displayName}</b><br/><small>{item.lastTradeAt ? new Date(item.lastTradeAt).toLocaleString() : "No recorded trade"}</small></span><strong>{item.confirmedStock}</strong></li>)}</ul> : <div className="empty"><h2>No completed trades yet.</h2><p>Record a purchase or sale to begin the ledger.</p></div>}
        </section>
      </div>
      <section className="panel" style={{ marginTop: 20 }}><p className="eyebrow">QUICK ACTIONS</p><div className="grid action-grid"><a href={`/record${store.storeQuery}`}>Record a Sale</a><a href={`/approvals${store.storeQuery}`}>Review approval queue</a></div></section>
    </div></AppShell>;
  } catch {
    return <AppShell current="/dashboard" identity={staffShellIdentity(store)}><div className="page"><section className="card empty"><h1>Ledger unavailable.</h1><p>We could not load this store&apos;s current ledger. Please try again.</p></section></div></AppShell>;
  }
}
