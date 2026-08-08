import { eq } from "drizzle-orm";
import { readCatalogImportFile } from "@/lib/catalog/import-file";
import { catalogImportDisposition } from "@/lib/catalog/import-state";
import { activateCatalogVersion, stageCatalogBundle } from "@/lib/catalog/staging";
import { database, db } from "@/db/runtime";
import { catalogVersions } from "@/db/schema";
import { installOpeningReferences } from "@/db/seed";

async function main() {
  const fileName = process.env.SKYSTORE_CATALOG_BUNDLE ?? "skystore-catalog-current.json";
  const { bundle, issues } = await readCatalogImportFile(fileName);
  const [installed] = await db.select({ status: catalogVersions.status, sourceLoadOrderHash: catalogVersions.sourceLoadOrderHash })
    .from(catalogVersions)
    .where(eq(catalogVersions.version, bundle.version))
    .limit(1);
  if (catalogImportDisposition(installed, bundle.source.loadOrderSha256) === "already_active") {
    await installOpeningReferences();
    console.log(JSON.stringify({ status: "already_active", version: bundle.version, items: bundle.items.length, recipes: bundle.recipes.length }));
    return;
  }
  const staged = await stageCatalogBundle(bundle, null, issues);
  if (staged.blockingIssueCount > 0) {
    throw new Error(`Catalog ${staged.version} has ${staged.blockingIssueCount} blocking mappings and cannot be activated.`);
  }
  const active = await activateCatalogVersion(staged.version, null);
  await installOpeningReferences();
  console.log(JSON.stringify({ status: "active", version: active.version, items: staged.importedItemCount, aliases: staged.importedAliasCount, images: staged.importedImageCount }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.client.end();
  });
