export type InstalledCatalogVersion = {
  status: "staged" | "active" | "retired";
  sourceLoadOrderHash: string;
};

export type CatalogImportDisposition = "stage" | "already_active";

/**
 * Deployment bootstrap is allowed to encounter the exact active bundle again.
 * A version name may never silently point at different source data.
 */
export function catalogImportDisposition(
  installed: InstalledCatalogVersion | undefined,
  expectedSourceLoadOrderHash: string
): CatalogImportDisposition {
  if (!installed || installed.status !== "active") return "stage";
  if (installed.sourceLoadOrderHash !== expectedSourceLoadOrderHash) {
    throw new Error("The active catalog version has a different load-order hash.");
  }
  return "already_active";
}
