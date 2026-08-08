import { z } from "zod";

const artworkStatusSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal("Unresolved"),
  z.literal("Rendered"),
  z.literal("unresolved"),
  z.literal("rendered")
]).transform((value) => value === 1 || value === "Rendered" || value === "rendered" ? "rendered" as const : "unresolved" as const);

const builderArtworkSchema = z.object({
  status: artworkStatusSchema,
  fallbackIcon: z.string().min(1).max(512),
  modelPath: z.string().max(1024).nullable().optional(),
  renderPath: z.string().max(1024).nullable().optional()
}).strict();

const builderItemSchema = z.object({
  id: z.string().uuid(),
  stableKey: z.string().min(3).max(180),
  name: z.string().min(1).max(255),
  editorId: z.string().max(255).nullable().optional(),
  plugin: z.string().min(1).max(128),
  recordType: z.string().min(1).max(32),
  formId: z.string().min(1).max(16),
  category: z.string().min(1).max(80),
  gameValue: z.number().int().min(0).nullable().optional(),
  weight: z.number().finite().min(0).nullable().optional(),
  artwork: builderArtworkSchema,
  aliases: z.array(z.string().min(1).max(255)).max(100).default([]),
  metadata: z.record(z.string(), z.string()).default({})
}).strict();

const builderRecipeIngredientSchema = z.object({
  itemStableKey: z.string().min(3).max(180).nullable().optional().default(null),
  sourceFormKey: z.string().min(1).max(255),
  quantity: z.number().int().positive()
}).strict();

const builderRecipeMappingIssueSchema = z.object({
  role: z.string().min(1).max(64),
  sourceFormKey: z.string().min(1).max(255).nullable().optional().default(null),
  detail: z.string().min(1).max(1024)
}).strict();

const builderRecipeSchema = z.object({
  id: z.string().uuid(),
  stableKey: z.string().min(3).max(180),
  plugin: z.string().min(1).max(128),
  formId: z.string().min(1).max(16),
  editorId: z.string().max(255).nullable().optional().default(null),
  outputStableKey: z.string().min(3).max(180).nullable().optional().default(null),
  outputYield: z.number().int().positive(),
  ingredients: z.array(builderRecipeIngredientSchema).max(100),
  workbenchKey: z.string().min(1).max(255).nullable().optional().default(null),
  profession: z.string().min(1).max(80).nullable().optional().default(null),
  masteryTier: z.string().min(1).max(80).nullable().optional().default(null),
  laborFee: z.number().int().min(0).nullable().optional().default(null),
  conditions: z.array(z.string().min(1).max(1024)).max(100),
  unresolvedMappings: z.array(builderRecipeMappingIssueSchema).max(100),
  sources: z.array(z.string().min(1).max(512)).min(1).max(100)
}).strict();

const builderBundleSchema = z.object({
  schemaVersion: z.literal("1"),
  version: z.string().min(3).max(80),
  generatedAt: z.string().datetime({ offset: true }),
  source: z.object({
    game: z.literal("Skyrim"),
    release: z.string().min(1).max(16),
    dataFolder: z.string().min(1).max(2048),
    loadOrderSha256: z.string().regex(/^[a-f0-9]{32,128}$/i)
  }).strict(),
  items: z.array(builderItemSchema).min(1).max(250000),
  recipes: z.array(builderRecipeSchema).max(250000).default([])
}).strict();

export type BuilderCatalogBundle = z.output<typeof builderBundleSchema>;
export type CatalogImportIssue = {
  stableKey: string;
  code: "artwork_unresolved" | "alias_ambiguous" | "stable_id_mismatch" | "form_key_conflict" | "recipe_mapping_unresolved";
  blocking: boolean;
  detail: string;
};

export class CatalogBundleError extends Error {
  constructor(public readonly issues: string[]) {
    super("The catalog bundle is invalid.");
  }
}

/**
 * Validates the builder contract at the server boundary. It intentionally keeps the source
 * Data-folder path out of its result summaries so game installation paths never leak to clients.
 */
export function parseBuilderBundle(input: unknown): { bundle: BuilderCatalogBundle; issues: CatalogImportIssue[] } {
  const parsed = builderBundleSchema.safeParse(input);
  if (!parsed.success) {
    throw new CatalogBundleError(parsed.error.issues.map((issue) => `${issue.path.join(".") || "bundle"}: ${issue.message}`));
  }

  const bundle = parsed.data;
  const errors: string[] = [];
  const issues: CatalogImportIssue[] = [];
  const stableKeys = new Set<string>();
  const ids = new Set<string>();
  const recipeIds = new Set<string>();
  const recipeKeys = new Set<string>();
  const claimedAliases = new Map<string, string>();

  for (const item of bundle.items) {
    const expectedStableKey = `${item.plugin.toLowerCase()}:${item.formId.toLowerCase()}`;
    if (item.stableKey.toLowerCase() !== expectedStableKey) {
      errors.push(`${item.stableKey}: stableKey must equal plugin:formId.`);
    }
    if (!stableKeys.add(item.stableKey.toLowerCase())) errors.push(`${item.stableKey}: duplicate stableKey.`);
    if (!ids.add(item.id)) errors.push(`${item.stableKey}: duplicate stable UUID.`);
    if (!isSafeWebAssetPath(item.artwork.fallbackIcon)) errors.push(`${item.stableKey}: fallbackIcon must be a site-relative asset path.`);
    if (item.artwork.renderPath && !isSafeWebAssetPath(item.artwork.renderPath)) errors.push(`${item.stableKey}: renderPath must be a site-relative asset path.`);
    if (item.artwork.status === "rendered" && !item.artwork.renderPath) errors.push(`${item.stableKey}: rendered artwork needs renderPath.`);
    if (item.artwork.status === "unresolved") {
      issues.push({ stableKey: item.stableKey, code: "artwork_unresolved", blocking: false, detail: "No item-specific render was supplied; the category fallback will be used." });
    }
    for (const alias of [item.name, ...item.aliases]) {
      const normalized = normalizeAlias(alias);
      if (!normalized) continue;
      const firstOwner = claimedAliases.get(normalized);
      if (firstOwner && firstOwner !== item.stableKey) {
        issues.push({ stableKey: item.stableKey, code: "alias_ambiguous", blocking: false, detail: `Alias '${alias}' is also claimed by ${firstOwner}; it will not be added as a global alias.` });
      } else {
        claimedAliases.set(normalized, item.stableKey);
      }
    }
  }

  for (const recipe of bundle.recipes) {
    const expectedStableKey = `recipe:${recipe.plugin.toLowerCase()}:${recipe.formId.toLowerCase()}`;
    if (recipe.stableKey.toLowerCase() !== expectedStableKey) errors.push(`${recipe.stableKey}: recipe stableKey must equal recipe:plugin:formId.`);
    if (!recipeIds.add(recipe.id)) errors.push(`${recipe.stableKey}: duplicate recipe UUID.`);
    if (!recipeKeys.add(recipe.stableKey.toLowerCase())) errors.push(`${recipe.stableKey}: duplicate recipe stableKey.`);
    if (recipe.outputStableKey === null && !recipe.unresolvedMappings.some((mapping) => mapping.role === "output")) {
      issues.push({ stableKey: recipe.stableKey, code: "recipe_mapping_unresolved", blocking: false, detail: "Recipe output is not mapped to a catalog item." });
    }
    for (const mapping of recipe.unresolvedMappings) {
      issues.push({ stableKey: recipe.stableKey, code: "recipe_mapping_unresolved", blocking: false, detail: `${mapping.role}: ${mapping.detail}` });
    }
  }

  if (errors.length > 0) throw new CatalogBundleError(errors);
  return { bundle, issues };
}

export function normalizeAlias(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function isSafeWebAssetPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !value.split("/").includes("..");
}
