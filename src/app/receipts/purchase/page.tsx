import { AppShell, PageHeading } from "@/components/app-shell";
import { ReceiptForm } from "@/components/forms";
import { resolveStaffPageStore, staffShellIdentity } from "@/components/staff-page-context";

export const dynamic = "force-dynamic";
export default async function PurchasePage({ searchParams }: { searchParams: Promise<{ storeId?: string; itemId?: string }> }) {
  const query = await searchParams;
  const store = await resolveStaffPageStore(query.storeId);
  if (!store) return <AppShell current="/record"><div className="page"><section className="card empty"><h1>No store selected.</h1></section></div></AppShell>;
  const returnTo = query.itemId ? `/items/${encodeURIComponent(query.itemId)}${store.storeQuery}` : undefined;
  return <AppShell current="/record" identity={staffShellIdentity(store)}><div className="page"><PageHeading eyebrow={store.name.toUpperCase()} title="Record a store purchase"><p className="lede">Select the items, quantities, and what the store paid. Your account and submission time are recorded automatically.</p></PageHeading><ReceiptForm direction="purchase" storeId={store.id} initialItemId={query.itemId} returnTo={returnTo}/></div></AppShell>;
}
