import { AppShell, PageHeading } from "@/components/app-shell";
import { BulkPriceReport } from "@/components/bulk-price-report";
import { getAccessContext } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function BulkReportPage() {
  const access = await getAccessContext().catch(() => null);
  return <AppShell current="/guide" publicView publicAccount={Boolean(access)} showAdmin={access?.globalRole === "platform_admin"}><div className="page"><PageHeading eyebrow="PUBLIC MARKET REPORT" title="Bulk price report"><p className="lede">Record a run of item values without leaving the guide.</p></PageHeading><BulkPriceReport/></div></AppShell>;
}
