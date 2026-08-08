import { AppShell, PageHeading } from "@/components/app-shell";
import { resolveStaffPageStore, staffShellIdentity } from "@/components/staff-page-context";

export const dynamic = "force-dynamic";

export default async function RecordPage({ searchParams }: { searchParams: Promise<{ storeId?: string; itemId?: string }> }) {
  const query = await searchParams;
  const store = await resolveStaffPageStore(query.storeId);
  if (!store) return <AppShell current="/record"><div className="page"><section className="card empty"><h1>No store selected.</h1><p>You need store access before recording store activity.</p></section></div></AppShell>;

  const itemQuery = query.itemId ? `&itemId=${encodeURIComponent(query.itemId)}` : "";
  return <AppShell current="/record" identity={staffShellIdentity(store)}><div className="page">
    <PageHeading eyebrow={store.name.toUpperCase()} title="Record a Sale"><p className="lede">Choose what you want to record.</p></PageHeading>
    <div className="grid admin-grid">
      <a className="card" href={`/receipts/sale${store.storeQuery}${itemQuery}`}><p className="eyebrow">STORE</p><h2>Record a store sale</h2><p>Record items sold by the store. Stock is reduced automatically.</p></a>
      <a className="card" href={`/street-report${store.storeQuery}${itemQuery}`}><p className="eyebrow">STREET</p><h2>Record a street price</h2><p>Record the value assigned during a street trade. Store stock is not affected.</p></a>
      <a className="card" href={`/receipts/purchase${store.storeQuery}${itemQuery}`}><p className="eyebrow">STORE</p><h2>Record a store purchase</h2><p>Record items acquired by the store. Stock is increased automatically.</p></a>
    </div>
  </div></AppShell>;
}
