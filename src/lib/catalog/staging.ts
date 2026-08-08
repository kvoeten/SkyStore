import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/runtime";
import { auditEvents, catalogAliases, catalogImages, catalogItems, catalogVersions, recipeIngredients, recipes } from "@/db/schema";
import { normalizeAlias, type BuilderCatalogBundle, type CatalogImportIssue } from "./bundle";
import { prepareCatalogRecipes } from "./recipes";

const pageSize = 1_000;

export class CatalogStageError extends Error {
  constructor(public readonly code: "active_version" | "missing_version" | "blocking_mappings", message: string) {
    super(message);
  }
}

export type CatalogStageResult = {
  catalogVersionId: string;
  version: string;
  importedItemCount: number;
  importedAliasCount: number;
  importedImageCount: number;
  importedRecipeCount: number;
  issues: CatalogImportIssue[];
  blockingIssueCount: number;
};

/**
 * Stages a normalized, already-validated builder bundle. Existing stable keys retain their
 * database IDs, so receipts and stock history never have their foreign keys rewritten.
 */
export async function stageCatalogBundle(bundle: BuilderCatalogBundle, actorId: string | null, initialIssues: CatalogImportIssue[] = []): Promise<CatalogStageResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('skystore_catalog_import'))`);
    const [knownVersion] = await tx.select().from(catalogVersions).where(eq(catalogVersions.version, bundle.version)).limit(1);
    if (knownVersion?.status === "active") throw new CatalogStageError("active_version", "An active catalog version is immutable. Build a new version before importing.");
    const catalogVersion = knownVersion ?? (await tx.insert(catalogVersions).values({ version: bundle.version, sourceLoadOrderHash: bundle.source.loadOrderSha256, status: "staged" }).returning())[0];

    if (catalogVersion.sourceLoadOrderHash !== bundle.source.loadOrderSha256) {
      throw new CatalogStageError("active_version", "A staged catalog version cannot be reused with a different load-order hash.");
    }

    const issues = [...initialIssues];
    const existingItems = await tx.select({ id: catalogItems.id, stableKey: catalogItems.stableKey, plugin: catalogItems.plugin, localFormId: catalogItems.localFormId }).from(catalogItems);
    const existingByStableKey = new Map(existingItems.map((item) => [item.stableKey.toLowerCase(), item]));
    const existingByFormKey = new Map(existingItems.filter((item) => item.plugin && item.localFormId).map((item) => [`${item.plugin!.toLowerCase()}:${item.localFormId!.toLowerCase()}`, item]));

    const stageableItems = bundle.items
      .sort((left, right) => left.stableKey.localeCompare(right.stableKey))
      .filter((item) => {
        const priorByForm = existingByFormKey.get(item.stableKey.toLowerCase());
        const priorByStable = existingByStableKey.get(item.stableKey.toLowerCase());
        if (priorByForm && !priorByStable) {
          issues.push({ stableKey: item.stableKey, code: "form_key_conflict", blocking: true, detail: `The local plugin/Form ID is already attached to historic item ${priorByForm.id} under a different stable key.` });
          return false;
        }
        if (priorByStable && priorByStable.id !== item.id) {
          issues.push({ stableKey: item.stableKey, code: "stable_id_mismatch", blocking: false, detail: `Existing SkyStore item ${priorByStable.id} is retained instead of replacing its historic ID with ${item.id}.` });
        }
        return true;
      });

    for (const batch of chunks(stageableItems, pageSize)) {
      await tx.insert(catalogItems).values(batch.map((item) => ({
        id: item.id,
        catalogVersionId: catalogVersion.id,
        stableKey: item.stableKey,
        plugin: item.plugin,
        localFormId: item.formId,
        displayName: item.name,
        editorId: item.editorId ?? null,
        recordType: item.recordType,
        category: item.category,
        status: "active" as const,
        value: item.gameValue ?? null,
        weight: item.weight?.toFixed(3) ?? null,
        metadata: { ...item.metadata, artwork: { sourceModelPath: item.artwork.modelPath ?? null, sourceStatus: item.artwork.status } }
      }))).onConflictDoUpdate({
        target: catalogItems.stableKey,
        set: {
          catalogVersionId: catalogVersion.id,
          plugin: sql`excluded.plugin`, localFormId: sql`excluded.local_form_id`, displayName: sql`excluded.display_name`, editorId: sql`excluded.editor_id`,
          recordType: sql`excluded.record_type`, category: sql`excluded.category`, status: "active", value: sql`excluded.value`, weight: sql`excluded.weight`, metadata: sql`excluded.metadata`, retiredAt: null
        }
      });
    }

    const stagedIds = new Map<string, string>();
    for (const batch of chunks(stageableItems.map((item) => item.stableKey), pageSize)) {
      const rows = await tx.select({ id: catalogItems.id, stableKey: catalogItems.stableKey }).from(catalogItems).where(inArray(catalogItems.stableKey, batch));
      rows.forEach((row) => stagedIds.set(row.stableKey.toLowerCase(), row.id));
    }

    const currentAliases = await tx.select({ itemId: catalogAliases.itemId, normalizedAlias: catalogAliases.normalizedAlias }).from(catalogAliases);
    const aliasOwners = new Map(currentAliases.map((alias) => [alias.normalizedAlias, alias.itemId]));
    const aliasesToInsert: Array<{ itemId: string; alias: string; normalizedAlias: string }> = [];
    for (const item of stageableItems) {
      const itemId = stagedIds.get(item.stableKey.toLowerCase());
      if (!itemId) continue;
      for (const alias of uniqueAliases([item.name, ...item.aliases])) {
        const normalizedAlias = normalizeAlias(alias);
        const owner = aliasOwners.get(normalizedAlias);
        if (owner && owner !== itemId) {
          issues.push({ stableKey: item.stableKey, code: "alias_ambiguous", blocking: false, detail: `Alias '${alias}' is already assigned to another historic item and was left unchanged.` });
          continue;
        }
        if (!owner) {
          aliasOwners.set(normalizedAlias, itemId);
          aliasesToInsert.push({ itemId, alias, normalizedAlias });
        }
      }
    }
    for (const batch of chunks(aliasesToInsert, pageSize)) await tx.insert(catalogAliases).values(batch).onConflictDoNothing();

    // Artwork is an exact projection of the active catalog manifest. Replacing it
    // transactionally removes obsolete category art, renderer output, and legacy
    // web-capture mappings without touching item identities or trade history.
    await tx.delete(catalogImages);
    const imageKeys = new Set<string>();
    const imagesToInsert: Array<{ itemId: string; url: string; kind: string; isFallback: boolean }> = [];
    for (const item of stageableItems) {
      const itemId = stagedIds.get(item.stableKey.toLowerCase());
      if (!itemId) continue;
      const desired = [{ url: item.artwork.fallbackIcon, kind: "fallback", isFallback: true }, ...(item.artwork.renderPath ? [{ url: item.artwork.renderPath, kind: "render", isFallback: false }] : [])];
      for (const image of desired) {
        const key = `${itemId}:${image.url}`;
        if (!imageKeys.has(key)) {
          imageKeys.add(key);
          imagesToInsert.push({ itemId, ...image });
        }
      }
    }
    for (const batch of chunks(imagesToInsert, pageSize)) await tx.insert(catalogImages).values(batch);

    const preparedRecipes = prepareCatalogRecipes(bundle.recipes, stagedIds);
    issues.push(...preparedRecipes.issues);
    if (preparedRecipes.recipes.length) {
      for (const batch of chunks(preparedRecipes.recipes, pageSize)) {
        await tx.insert(recipes).values(batch.map((recipe) => ({
          outputItemId: recipe.outputItemId, outputYield: recipe.outputYield, masteryTier: recipe.masteryTier, laborFee: recipe.laborFee,
          submittedBy: null, storeId: null, catalogVersionId: catalogVersion.id, sourceStableKey: recipe.sourceStableKey, workbenchKey: recipe.workbenchKey,
          profession: recipe.profession, conditions: recipe.conditions, sourceReferences: recipe.sourceReferences, approval: "approved" as const, isCatalogDefault: true
        }))).onConflictDoUpdate({ target: recipes.sourceStableKey, set: {
          outputItemId: sql`excluded.output_item_id`, outputYield: sql`excluded.output_yield`, masteryTier: sql`excluded.mastery_tier`, laborFee: sql`excluded.labor_fee`,
          catalogVersionId: catalogVersion.id, workbenchKey: sql`excluded.workbench_key`, profession: sql`excluded.profession`, conditions: sql`excluded.conditions`, sourceReferences: sql`excluded.source_references`, approval: "approved", isCatalogDefault: true
        } });
      }
      const sourceKeys = preparedRecipes.recipes.map((recipe) => recipe.sourceStableKey);
      const persisted = new Map((await tx.select({ id: recipes.id, sourceStableKey: recipes.sourceStableKey }).from(recipes).where(inArray(recipes.sourceStableKey, sourceKeys))).flatMap((recipe) => recipe.sourceStableKey ? [[recipe.sourceStableKey, recipe.id] as const] : []));
      const recipeIds = [...persisted.values()];
      if (recipeIds.length) await tx.delete(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeIds));
      const ingredientRows = preparedRecipes.recipes.flatMap((recipe) => {
        const recipeId = persisted.get(recipe.sourceStableKey);
        return recipeId ? recipe.ingredients.map((ingredient) => ({ recipeId, itemId: ingredient.itemId, quantity: ingredient.quantity })) : [];
      });
      for (const batch of chunks(ingredientRows, pageSize)) await tx.insert(recipeIngredients).values(batch);
    }

    const blockingIssueCount = issues.filter((issue) => issue.blocking).length;
    await tx.insert(auditEvents).values({
      actorId,
      action: "catalog.import.staged",
      entityType: "catalog_version",
      entityId: catalogVersion.id,
      after: {
        version: bundle.version,
        source: { game: bundle.source.game, release: bundle.source.release, loadOrderHash: bundle.source.loadOrderSha256 },
        importedItemCount: stageableItems.length,
        importedAliasCount: aliasesToInsert.length,
        importedImageCount: imagesToInsert.length,
        importedRecipeCount: preparedRecipes.recipes.length,
        blockingIssueCount,
        issues
      }
    });

    return { catalogVersionId: catalogVersion.id, version: bundle.version, importedItemCount: stageableItems.length, importedAliasCount: aliasesToInsert.length, importedImageCount: imagesToInsert.length, importedRecipeCount: preparedRecipes.recipes.length, issues, blockingIssueCount };
  });
}

export async function activateCatalogVersion(version: string, actorId: string | null): Promise<{ id: string; version: string; activatedAt: Date }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('skystore_catalog_import'))`);
    const [target] = await tx.select().from(catalogVersions).where(eq(catalogVersions.version, version)).limit(1);
    if (!target) throw new CatalogStageError("missing_version", "The requested catalog version is not staged.");
    if (target.status === "active") return { id: target.id, version: target.version, activatedAt: target.activatedAt ?? new Date() };

    const [stagingAudit] = await tx.select({ after: auditEvents.after }).from(auditEvents)
      .where(sql`${auditEvents.entityId} = ${target.id} and ${auditEvents.action} = 'catalog.import.staged'`)
      .orderBy(sql`${auditEvents.occurredAt} desc`).limit(1);
    const blockingIssueCount = readBlockingIssueCount(stagingAudit?.after);
    if (blockingIssueCount > 0) throw new CatalogStageError("blocking_mappings", "Resolve the blocking catalog mappings recorded in the staging report before activation.");

    const activatedAt = new Date();
    await tx.update(catalogVersions).set({ status: "retired" }).where(eq(catalogVersions.status, "active"));
    await tx.update(catalogVersions).set({ status: "active", activatedAt }).where(eq(catalogVersions.id, target.id));
    await tx.insert(auditEvents).values({ actorId, action: "catalog.version.activated", entityType: "catalog_version", entityId: target.id, after: { version: target.version } });
    return { id: target.id, version: target.version, activatedAt };
  });
}

function uniqueAliases(aliases: string[]): string[] {
  const seen = new Set<string>();
  return aliases.filter((alias) => {
    const normalized = normalizeAlias(alias);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function readBlockingIssueCount(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const count = (value as { blockingIssueCount?: unknown }).blockingIssueCount;
  return typeof count === "number" && Number.isInteger(count) && count > 0 ? count : 0;
}
