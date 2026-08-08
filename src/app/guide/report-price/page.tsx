import { AppShell, PageHeading } from "@/components/app-shell";
import { PublicPriceReportFlow } from "@/components/public-price-report-flow";
import { getAccessContext } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function ReportPricePage() {
  let signedIn = false;
  try { signedIn = Boolean(await getAccessContext()); } catch { signedIn = false; }
  return <AppShell current="/guide" publicView publicAccount={signedIn}>
    <div className="page">
      <PageHeading eyebrow="PUBLIC MARKET REPORT" title="Report a price"><p className="lede">Share the price an item recently traded for on the street.</p></PageHeading>
      <PublicPriceReportFlow/>
    </div>
  </AppShell>;
}
