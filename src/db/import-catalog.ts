import { readCatalogImportFile } from "@/lib/catalog/import-file";
import { activateCatalogVersion, stageCatalogBundle } from "@/lib/catalog/staging";
import { database } from "@/db/runtime";
import { installOpeningReferences } from "@/db/seed";

async function main() {
  const fileName = process.env.SKYSTORE_CATALOG_BUNDLE ?? "skystore-catalog-current.json";
  const { bundle, issues } = await readCatalogImportFile(fileName);
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
