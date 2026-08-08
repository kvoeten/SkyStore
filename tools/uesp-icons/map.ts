import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mapCatalogIcons, type UespCatalogItem, type UespIconEntry } from "@/lib/catalog/uesp-icon-map";

const DEFAULT_OUTPUT = "catalog/generated/uesp-icons";

function argument(name: string, fallback?: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : process.argv[at + 1];
}

type CatalogBundle = { generatedAt: string; version: string; items: Array<{ stableKey: string; name: string; editorId?: string | null; formId?: string | null; category: string; aliases?: string[]; artwork?: { modelPath?: string | null } }> };
type IconManifest = { schemaVersion: "1"; source: { wiki: string; rootCategory: string; fetchedAt: string }; files: UespIconEntry[]; incomplete?: boolean };
type CategoryFallbackManifest = { schemaVersion: "1"; provider: "skystore_category_art"; source: { generatedBy: string; generatedAt: string }; files: UespIconEntry[] };

async function main() {
  const output = argument("--output", DEFAULT_OUTPUT)!;
  const catalogPath = argument("--catalog", "catalog/generated/skystore-catalog-current.json")!;
  const fallbackPath = argument("--fallback-manifest", "catalog/generated/catalog-icons/skystore-category-fallback-manifest.json")!;
  const source = JSON.parse(await readFile(catalogPath, "utf8")) as CatalogBundle;
  const iconManifest = JSON.parse(await readFile(join(output, "uesp-icons-manifest.json"), "utf8")) as IconManifest;
  const fallbackManifest = JSON.parse(await readFile(fallbackPath, "utf8")) as CategoryFallbackManifest;
  if (iconManifest.incomplete) throw new Error("Refusing to map an incomplete icon crawl. Re-run ingestion without --limit before generating the production mapping.");
  if (fallbackManifest.schemaVersion !== "1" || fallbackManifest.provider !== "skystore_category_art" || !Array.isArray(fallbackManifest.files)) throw new Error("SkyStore category fallback manifest is invalid.");
  const mappings = mapCatalogIcons(source.items.map((item) => ({ ...item, modelPath: item.artwork?.modelPath ?? null })) satisfies UespCatalogItem[], iconManifest.files, fallbackManifest.files);
  if (mappings.length !== source.items.length || mappings.some((mapping) => !mapping.localPath.startsWith("/uesp-icons/") && !mapping.localPath.startsWith("/catalog-icons/"))) throw new Error("Icon mapping does not cover every catalog item with a local UESP or SkyStore category asset.");
  const checksum = createHash("sha256").update(JSON.stringify(mappings)).digest("hex");
  const manifest = {
    schemaVersion: "1" as const,
    catalogVersion: source.version,
    catalogGeneratedAt: source.generatedAt,
    iconSource: { wiki: iconManifest.source.wiki, rootCategory: iconManifest.source.rootCategory, fetchedAt: iconManifest.source.fetchedAt, fallbackProvider: { generatedBy: fallbackManifest.source.generatedBy, generatedAt: fallbackManifest.source.generatedAt } },
    checksum,
    mappings
  };
  await writeFile(join(output, "uesp-icon-mapping.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const exact = mappings.filter((mapping) => mapping.kind === "exact").length;
  console.log(JSON.stringify({ output, catalogVersion: source.version, mappings: mappings.length, exact, categoryFallbacks: mappings.length - exact, checksum }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
