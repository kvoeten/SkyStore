import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { CatalogBundleError, parseBuilderBundle, type BuilderCatalogBundle, type CatalogImportIssue } from "./bundle";

const maximumBundleBytes = 100 * 1024 * 1024;

export class CatalogImportFileError extends Error {}

export function catalogImportDirectory(): string {
  const configuredDirectory = process.env.SKYSTORE_CATALOG_IMPORT_DIR ?? path.join(process.cwd(), "storage", "catalog-import");
  // This is an operator-mounted volume, not an application source dependency.
  return path.resolve(/* turbopackIgnore: true */ configuredDirectory);
}

/** A request names a file already placed by an administrator; it can never upload arbitrary JSON or leave this directory. */
export function resolveCatalogImportFile(fileName: string, importDirectory = catalogImportDirectory()): string {
  if (!fileName.endsWith(".json") || path.isAbsolute(fileName)) throw new CatalogImportFileError("Only a relative .json bundle name is allowed.");
  const root = path.resolve(importDirectory);
  const resolved = path.resolve(root, fileName);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new CatalogImportFileError("Catalog import file must stay inside the configured import directory.");
  return resolved;
}

export async function readCatalogImportFile(fileName: string): Promise<{ bundle: BuilderCatalogBundle; issues: CatalogImportIssue[]; filePath: string }> {
  const filePath = resolveCatalogImportFile(fileName);
  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(filePath);
  } catch {
    throw new CatalogImportFileError("The requested catalog bundle does not exist.");
  }
  if (!fileStat.isFile() || fileStat.size > maximumBundleBytes) throw new CatalogImportFileError("Catalog bundle is not a permitted file size.");
  // Path traversal is rejected before stat; this second realpath check also rejects a symlink
  // inside the import directory that points at an arbitrary server file.
  const importRoot = await realpath(/* turbopackIgnore: true */ catalogImportDirectory()).catch(() => null);
  const realFilePath = await realpath(/* turbopackIgnore: true */ filePath).catch(() => null);
  if (!importRoot || !realFilePath || !realFilePath.startsWith(`${importRoot}${path.sep}`)) {
    throw new CatalogImportFileError("Catalog bundle must resolve inside the configured import directory.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    throw new CatalogImportFileError("Catalog bundle is not valid JSON.");
  }
  try {
    const { bundle, issues } = parseBuilderBundle(raw);
    return { bundle, issues, filePath };
  } catch (error) {
    if (error instanceof CatalogBundleError) throw error;
    throw new CatalogImportFileError("Catalog bundle could not be read.");
  }
}
