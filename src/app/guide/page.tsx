import Link from "next/link";
import { AppShell, PageHeading } from "@/components/app-shell";
import { DelayedMarketTable } from "@/components/delayed-market-table";
import { PrivateMarketTable } from "@/components/private-market-table";
import { PublicMarketHighlights } from "@/components/public-market-highlights";
import { resolveStaffPageStore, staffShellIdentity } from "@/components/staff-page-context";
import { getAccessContext } from "@/lib/authorization";
import { getPrivateMarketGuide } from "@/lib/services/staff-queries";

export const dynamic = "force-dynamic";

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ q?: string; storeId?: string; view?: string }> }) {
  const { q, storeId, view } = await searchParams;
  const forcePublic = view === "public";
  let access: Awaited<ReturnType<typeof getAccessContext>> = null;
  let authFailed = false;
  try { access = await getAccessContext(); } catch { authFailed = true; }
  const mayHaveStore = Boolean(access && (access.memberships.length || access.globalRole === "platform_admin"));
  let store: Awaited<ReturnType<typeof resolveStaffPageStore>> = null;
  if (!forcePublic && mayHaveStore) {
    try { store = await resolveStaffPageStore(storeId); } catch { authFailed = true; }
  }
  if (store) {
    let rows: Awaited<ReturnType<typeof getPrivateMarketGuide>> | null = null;
    try { rows = await getPrivateMarketGuide(store.id, q ?? ""); } catch { rows = null; }
    if (!rows) {
      return <AppShell current="/guide" identity={staffShellIdentity(store)}><div className="page"><section className="card empty"><h1>The private price guide could not load.</h1><p>Your session can still be recovered without reloading this page.</p><div className="button-row" style={{ justifyContent: "center" }}><a className="outline" href="/guide?view=public">Open public price guide</a><a className="text-button" href="/logout">Sign out</a></div></section></div></AppShell>;
    }
    return <AppShell current="/guide" identity={staffShellIdentity(store)} searchAction="/guide" searchStoreId={store.id}><div className="page">
      <PageHeading eyebrow={store.name.toUpperCase()} title="Price guide"><p className="lede">Current store rates and approved sale activity. Search still covers the full active catalog.</p></PageHeading>
      <section className="panel"><div className="notice"><b>{rows.length} items</b><span>{q?.trim() ? "Showing catalog matches for this search." : "Recently sold items lead the list, followed by currently priced stock."}</span></div><PrivateMarketTable rows={rows} storeId={store.id} searched={Boolean(q?.trim())}/></section>
    </div></AppShell>;
  }
  return <AppShell current="/guide" publicView publicAccount={Boolean(access) || authFailed} searchPublicView={forcePublic}><div className="page">
    <PageHeading eyebrow="SKYSTORE" title="Public price guide" actions={<Link className="button public-report-button" href="/guide/report-price">REPORT PRICE</Link>}><p className="lede">Search Store Prices from participating stores.</p></PageHeading>
    <div className="grid guide-grid"><section className="panel"><DelayedMarketTable query={q}/><p className="market-footnote">Public price information can be up to 7 days behind on real market trends. Visit your local store for up-to-date pricing information.</p></section><aside className="stack"><PublicMarketHighlights/><section className="card"><p className="eyebrow">PRICE GUIDE</p><p>Prices shown are customer-facing Store Prices.</p></section></aside></div>
  </div></AppShell>;
}
