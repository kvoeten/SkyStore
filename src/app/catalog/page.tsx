import { redirect } from "next/navigation";
import { AppShell, PageHeading } from "@/components/app-shell";
import { CatalogOperations } from "@/components/catalog-operations";
import { requireAccess } from "@/lib/authorization";
import { getCatalogAdminData } from "@/lib/catalog/admin-data";

export default async function CatalogPage() {
  const access = await requireAccess();
  if (access.globalRole !== "platform_admin") redirect("/dashboard");
  const versions = await getCatalogAdminData();
  return <AppShell current="/catalog" identity={{ role: "Platform administrator", verified: true }}><div className="page">
    <PageHeading eyebrow="PLATFORM ADMIN · CATALOG OPERATIONS" title={<>Catalog intake &amp; <em>item mapping.</em></>}>
      <p className="lede">Normalized Keizaal metadata and web-safe images enter the ledger through a staged catalog version. Skyrim game files never enter Docker services.</p>
    </PageHeading>
    <CatalogOperations versions={versions} />
  </div></AppShell>;
}
