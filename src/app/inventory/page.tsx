/* eslint-disable react-hooks/error-boundaries -- the catch handles only the awaited database read. */
import { AppShell, PageHeading } from "@/components/app-shell";
import { InventoryReconcileForm } from "@/components/inventory-reconcile-form";
import { resolveStaffPageStore, staffShellIdentity } from "@/components/staff-page-context";
import { getInventory } from "@/lib/services/staff-queries";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ storeId?: string; q?: string; category?: string }> }) {
  const params = await searchParams;
  const store = await resolveStaffPageStore(params.storeId);
  if (!store) return <AppShell current="/inventory"><div className="page"><section className="card empty"><h1>No store selected.</h1><p>Select a store you belong to before viewing inventory.</p></section></div></AppShell>;

  try {
    const items = await getInventory(store.id, params.q?.trim() ?? "", params.category);
    return <AppShell current="/inventory" identity={staffShellIdentity(store)}><div className="page">
      <PageHeading eyebrow={store.name.toUpperCase()} title="Inventory"><p className="lede">A quick stock helper for the live store. Purchases add stock, sales subtract it, and the current stock shown here never falls below zero.</p></PageHeading>
      <InventoryReconcileForm storeId={store.id}/>
      <div className="notice"><b>{items.length} tracked items</b><span>Use the stock update above whenever the ledger differs from the in-game store.</span></div>
      <section className="panel">
        <form className="panel-head" action="/inventory"><input type="hidden" name="storeId" value={store.id}/><label className="search"><span>⌕</span><input name="q" defaultValue={params.q} placeholder="Search your stock"/></label><button className="outline" type="submit">Search</button></form>
        {items.length ? <div className="table-wrap"><table><thead><tr><th>Item</th><th>Approved stock</th><th>Pending change</th><th>Current stock</th><th>Last movement</th></tr></thead><tbody>{items.map((item) => <tr key={item.itemId}><td><a href={`/items/${item.itemId}${store.storeQuery}`} className="item-name"><span className="item-dot">◇</span><span>{item.displayName}<br/><small>{item.category}</small></span></a></td><td>{item.confirmedStock}</td><td>{item.provisionalStock}</td><td>{item.availableStock}</td><td>{item.lastTradeAt ? new Date(item.lastTradeAt).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div> : <div className="empty"><h2>No matching stock.</h2><p>Use the stock update above to begin tracking any catalog item.</p></div>}
      </section>
    </div></AppShell>;
  } catch {
    return <AppShell current="/inventory" identity={staffShellIdentity(store)}><div className="page"><section className="card empty"><h1>Inventory unavailable.</h1><p>Please refresh and try again.</p></section></div></AppShell>;
  }
}
