import { AppShell, PageHeading } from "@/components/app-shell";
import { ObservationForm } from "@/components/forms";
import { resolveStaffPageStore, staffShellIdentity } from "@/components/staff-page-context";

export const dynamic = "force-dynamic";
export default async function StreetReportPage({ searchParams }: { searchParams: Promise<{ storeId?: string; itemId?: string }> }) {
  const query = await searchParams;
  const store = await resolveStaffPageStore(query.storeId);
  if (!store) return <AppShell current="/record"><div className="page"><section className="card empty"><h1>No store selected.</h1></section></div></AppShell>;
  const returnTo = query.itemId ? `/items/${encodeURIComponent(query.itemId)}${store.storeQuery}` : undefined;
  return <AppShell current="/record" identity={staffShellIdentity(store)}><div className="page"><PageHeading eyebrow={store.name.toUpperCase()} title="Record a street price"><p className="lede">Record the value assigned to an item during a street trade. It is a price report and never changes store stock.</p></PageHeading><ObservationForm storeId={store.id} initialItemId={query.itemId} returnTo={returnTo}/></div></AppShell>;
}
