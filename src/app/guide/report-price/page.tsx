import { AppShell, PageHeading } from "@/components/app-shell";
import { PublicPriceReportFlow } from "@/components/public-price-report-flow";
import { getAccessContext } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function ReportPricePage() {
  let access: Awaited<ReturnType<typeof getAccessContext>> = null;
  try { access = await getAccessContext(); } catch { access = null; }
  return <AppShell current="/guide" publicView publicAccount={Boolean(access)} showAdmin={access?.globalRole === "platform_admin"}>
    <div className="page">
      <PageHeading eyebrow="PUBLIC MARKET REPORT" title="Report a price"><p className="lede">Share the price an item recently traded for on the street.</p></PageHeading>
      <PublicPriceReportFlow/>
    </div>
  </AppShell>;
}
