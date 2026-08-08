import { AppShell, PageHeading } from "@/components/app-shell";
import { StoreAdminLive } from "@/components/store-admin-live";
import { StoreDisplayName } from "@/components/store-display-name";
import { resolveStaffPageStore, staffShellIdentity } from "@/components/staff-page-context";

export const dynamic = "force-dynamic";

export default async function StoreAdminPage({ searchParams }: { searchParams: Promise<{ storeId?: string }> }) {
  const store = await resolveStaffPageStore((await searchParams).storeId);
  if (!store) return <AppShell current="/store-admin"><div className="page"><section className="card empty"><h1>No store selected.</h1><p>You need store access to manage staff and pricing.</p></section></div></AppShell>;

  const canManage = store.role === "manager" || store.role === "owner";
  return <AppShell current="/store-admin" identity={staffShellIdentity(store)}><div className="page">
    <PageHeading eyebrow={`${store.name.toUpperCase()} · ${store.role.toUpperCase()}`} title="Store staff & trading rules">
      <p className="lede">Managers control membership, trust, pricing targets, and advanced ledger corrections. Every store member can update the actual shelf count from Inventory.</p>
    </PageHeading>
    {canManage ? <StoreAdminLive storeId={store.id} targetMarkupBps={store.targetMarkupBps} canManage/> : <section className="card empty"><h2>Manager access required.</h2><p>You can reconcile shelf counts from Inventory, but staffing, pricing, and manual ledger adjustments require a manager.</p></section>}
    <StoreDisplayName storeId={store.id} initialValue={store.displayName}/>
  </div></AppShell>;
}
