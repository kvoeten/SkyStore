import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { and, inArray, sql } from "drizzle-orm";
import { database, db } from "@/db/runtime";
import { auditEvents, catalogImages, catalogItems } from "@/db/schema";

type Mapping = {
  stableKey: string;
  localPath: string;
  kind: "exact" | "category_fallback";
  provider: "uesp" | "skystore_category_art";
  icon: { sha1: string; mime: string; width: number | null; height: number | null; sourcePageUrl: string; originalUrl: string };
};
type MappingManifest = { schemaVersion: "1"; catalogVersion: string; checksum: string; mappings: Mapping[] };

const CHUNK = 1_000;
function chunks<T>(values: T[], size = CHUNK): T[][] { const out: T[][] = []; for (let at = 0; at < values.length; at += size) out.push(values.slice(at, at + size)); return out; }

function parseManifest(value: unknown): MappingManifest {
  if (!value || typeof value !== "object") throw new Error("UESP mapping manifest is not an object.");
  const manifest = value as Partial<MappingManifest>;
  if (manifest.schemaVersion !== "1" || !Array.isArray(manifest.mappings) || !manifest.catalogVersion || !manifest.checksum) throw new Error("UESP mapping manifest is incomplete.");
  for (const mapping of manifest.mappings) {
    if ((mapping.kind === "exact" && mapping.provider !== "uesp") || (mapping.kind === "category_fallback" && mapping.provider !== "skystore_category_art")) throw new Error(`Unexpected image provider/kind pair for ${mapping.stableKey ?? "unknown item"}.`);
    const permittedDirectory = mapping.provider === "uesp" ? "/uesp-icons/" : "/catalog-icons/";
    if (!mapping.stableKey || !mapping.localPath.startsWith(permittedDirectory) || !/^[a-f0-9]{40}$/i.test(mapping.icon?.sha1 ?? "")) throw new Error(`Unsafe or unverified icon mapping for ${mapping.stableKey ?? "unknown item"}.`);
    if (basename(mapping.localPath) !== mapping.localPath.slice(permittedDirectory.length)) throw new Error(`Icon mapping is not a flat local asset path: ${mapping.localPath}`);
  }
  const recomputed = createHash("sha256").update(JSON.stringify(manifest.mappings)).digest("hex");
  if (recomputed !== manifest.checksum) throw new Error("UESP mapping manifest checksum does not match its mappings.");
  return manifest as MappingManifest;
}

async function main() {
  const manifestPath = resolve(process.env.SKYSTORE_UESP_MAPPING ?? "catalog/generated/uesp-icons/uesp-icon-mapping.json");
  const manifest = parseManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('skystore_uesp_icon_import'))`);
    const stableKeys = manifest.mappings.map((mapping) => mapping.stableKey);
    const items = [] as Array<{ id: string; stableKey: string }>;
    for (const batch of chunks(stableKeys)) items.push(...await tx.select({ id: catalogItems.id, stableKey: catalogItems.stableKey }).from(catalogItems).where(inArray(catalogItems.stableKey, batch)));
    const byStableKey = new Map(items.map((item) => [item.stableKey, item]));
    const unresolved = manifest.mappings.filter((mapping) => !byStableKey.has(mapping.stableKey));
    if (unresolved.length) throw new Error(`UESP mapping references ${unresolved.length} catalog items that are not installed. Import and activate ${manifest.catalogVersion} first.`);
    const itemIds = items.map((item) => item.id);
    for (const batch of chunks(itemIds)) {
      await tx.delete(catalogImages).where(and(inArray(catalogImages.itemId, batch), inArray(catalogImages.kind, ["uesp", "skystore_category_art"])));
    }
    const inserts = manifest.mappings.map((mapping) => {
      const item = byStableKey.get(mapping.stableKey)!;
      const kind = mapping.kind === "exact" ? "uesp" : "skystore_category_art";
      return { itemId: item.id, url: mapping.localPath, kind, isFallback: mapping.kind !== "exact", width: mapping.icon.width, height: mapping.icon.height };
    });
    for (const batch of chunks(inserts)) if (batch.length) await tx.insert(catalogImages).values(batch);
    await tx.insert(auditEvents).values({
      actorId: null,
      action: "catalog.images.uesp_imported",
      entityType: "uesp_icon_mapping",
      after: { manifestPath: manifestPath.replace(/\\/g, "/"), catalogVersion: manifest.catalogVersion, checksum: manifest.checksum, mappedItems: manifest.mappings.length, exact: manifest.mappings.filter((mapping) => mapping.kind === "exact").length, categoryFallbacks: manifest.mappings.filter((mapping) => mapping.kind === "category_fallback").length, inserted: inserts.length }
    });
    return { mapped: manifest.mappings.length, inserted: inserts.length };
  });
  console.log(JSON.stringify({ status: "complete", catalogVersion: manifest.catalogVersion, checksum: manifest.checksum, ...result }));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await database.client.end(); });
