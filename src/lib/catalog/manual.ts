import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/runtime";
import { auditEvents, catalogAliases, catalogImages, catalogItems } from "@/db/schema";
import { isSafeWebAssetPath, normalizeAlias } from "./bundle";

export const createManualCatalogItemCommand = z.object({
  name: z.string().trim().min(1).max(255),
  category: z.string().trim().min(1).max(80),
  fallbackIcon: z.string().min(1).max(512),
  editorId: z.string().trim().max(255).optional(),
  aliases: z.array(z.string().trim().min(1).max(255)).max(50).default([])
}).strict().superRefine((value, context) => {
  if (!isSafeWebAssetPath(value.fallbackIcon)) context.addIssue({ code: "custom", path: ["fallbackIcon"], message: "Choose a site-relative category icon." });
});

export type CreateManualCatalogItemCommand = z.output<typeof createManualCatalogItemCommand>;

export async function createManualCatalogItem(command: CreateManualCatalogItemCommand, actorId: string) {
  const id = crypto.randomUUID();
  const stableKey = `manual:${id}`;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('skystore_catalog_manual_item'))`);
    await tx.insert(catalogItems).values({
      id,
      stableKey,
      displayName: command.name,
      editorId: command.editorId || null,
      recordType: "custom",
      category: command.category,
      status: "active",
      metadata: { custom: true, createdVia: "platform_catalog" }
    });

    const aliasesSkipped: string[] = [];
    const aliases = uniqueAliases([command.name, ...command.aliases]);
    for (const alias of aliases) {
      const normalizedAlias = normalizeAlias(alias);
      const [owner] = await tx.select({ itemId: catalogAliases.itemId }).from(catalogAliases).where(eq(catalogAliases.normalizedAlias, normalizedAlias)).limit(1);
      if (owner && owner.itemId !== id) {
        aliasesSkipped.push(alias);
        continue;
      }
      if (!owner) await tx.insert(catalogAliases).values({ itemId: id, alias, normalizedAlias });
    }
    await tx.insert(catalogImages).values({ itemId: id, url: command.fallbackIcon, kind: "fallback", isFallback: true });
    await tx.insert(auditEvents).values({
      actorId,
      action: "catalog.item.manual_created",
      entityType: "catalog_item",
      entityId: id,
      after: { stableKey, category: command.category, fallbackIcon: command.fallbackIcon, aliasesSkipped }
    });
    return { id, stableKey, aliasesSkipped };
  });
}

function uniqueAliases(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = normalizeAlias(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
