import { AppShell, PageHeading } from "@/components/app-shell";
import { CustomLedgerReport } from "@/components/custom-ledger-report";
import { getAccessContext } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function ReportLedgerPage() {
  const access = await getAccessContext().catch(() => null);
  return <AppShell current="/guide" publicView publicAccount={Boolean(access)} showAdmin={access?.globalRole === "platform_admin"}><div className="page"><PageHeading eyebrow="PUBLIC MARKET REPORT" title="Report a custom ledger"><p className="lede">Send a sheet or pasted table for the administrator to review and add through the normal pricing process.</p></PageHeading><CustomLedgerReport/></div></AppShell>;
}
