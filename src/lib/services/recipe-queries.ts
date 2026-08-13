import { and, eq, ilike, inArray, isNotNull, isNull, lte, gte, or } from "drizzle-orm";
import { db } from "@/db/runtime";
import { catalogItems, officialPriceRules, recipeIngredients, recipes } from "@/db/schema";
import { MASTERY_TIERS } from "@/lib/professions";
import { getPublicMarketOverview } from "@/lib/public-market";
import { parseRecipeRequirements, type RecipeRequirement } from "@/lib/recipe-requirements";
import { itemFamilyBaseName } from "@/lib/catalog/item-families";
import { groupRecipeVariants } from "@/lib/tailoring-recipe-groups";

export type RecipeIngredientView = { itemId: string; name: string; quantity: number; unitPrice: number | null };
export type RecipeView = {
  id: string; outputItemId: string; outputName: string; outputYield: number;
  profession: string | null; masteryTier: string | null; laborFee: number;
  conditions: string[]; requirements: RecipeRequirement[];
  ingredients: RecipeIngredientView[]; materialCost: number | null; productPrice: number | null; missingPriceCount: number;
};

export type CatalogPriceFamily = {
  canonicalItemId: string;
  displayName: string;
  itemIds: string[];
};

async function recipeRowsFor(filter: ReturnType<typeof eq>) {
  const rows = await db.select({
    id: recipes.id, outputItemId: recipes.outputItemId, outputName: catalogItems.displayName,
    outputYield: recipes.outputYield, profession: recipes.profession, masteryTier: recipes.masteryTier,
    laborFee: recipes.laborFee, conditions: recipes.conditions
  }).from(recipes).innerJoin(catalogItems, eq(recipes.outputItemId, catalogItems.id))
    .where(and(filter, isNotNull(recipes.profession), eq(recipes.approval, "approved"), eq(recipes.isCatalogDefault, true), isNull(recipes.storeId), eq(catalogItems.status, "active")));
  if (!rows.length) return { rows, ingredients: [] };
  const ingredients = await db.select({ recipeId: recipeIngredients.recipeId, itemId: catalogItems.id, name: catalogItems.displayName, quantity: recipeIngredients.quantity })
    .from(recipeIngredients).innerJoin(catalogItems, eq(recipeIngredients.itemId, catalogItems.id))
    .where(inArray(recipeIngredients.recipeId, rows.map((recipe) => recipe.id)));
  return { rows, ingredients };
}

async function pricesFor(itemIds: string[], storeId: string | undefined, side: "store_pays" | "customer_pays") {
  const prices = new Map<string, number>();
  if (!itemIds.length) return prices;
  if (!storeId) {
    const overview = await getPublicMarketOverview();
    for (const rule of overview?.official ?? []) {
      if (itemIds.includes(rule.itemId) && rule.quantity[0] > 0) prices.set(rule.itemId, rule.septims[1] / rule.quantity[0]);
    }
    for (const estimate of overview?.estimates ?? []) {
      if (itemIds.includes(estimate.itemId) && (estimate.upperQuartile ?? estimate.median) != null) prices.set(estimate.itemId, Number(estimate.upperQuartile ?? estimate.median));
    }
    return prices;
  }
  const now = new Date();
  const rules = await db.select().from(officialPriceRules).where(and(
    inArray(officialPriceRules.itemId, itemIds), eq(officialPriceRules.side, side),
    or(isNull(officialPriceRules.storeId), eq(officialPriceRules.storeId, storeId)),
    lte(officialPriceRules.effectiveFrom, now), or(isNull(officialPriceRules.effectiveTo), gte(officialPriceRules.effectiveTo, now))
  ));
  for (const rule of rules.sort((a, b) => Number(a.storeId === storeId) - Number(b.storeId === storeId))) {
    if (rule.quantity > 0) prices.set(rule.itemId, rule.maximumSeptims / rule.quantity);
  }
  return prices;
}

function normalizeConditions(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((condition): condition is string => typeof condition === "string") : [];
}

function assemble(rows: Array<{ id: string; outputItemId: string; outputName: string; outputYield: number; profession: string | null; masteryTier: string | null; laborFee: number; conditions: unknown }>, ingredients: Array<{ recipeId: string; itemId: string; name: string; quantity: number }>, materialPrices: Map<string, number>, productPrices: Map<string, number>): RecipeView[] {
  return rows.map((recipe) => {
    const inputs = ingredients.filter((ingredient) => ingredient.recipeId === recipe.id).map((ingredient) => ({ itemId: ingredient.itemId, name: ingredient.name, quantity: ingredient.quantity, unitPrice: materialPrices.get(ingredient.itemId) ?? null }));
    const missingPriceCount = inputs.filter((ingredient) => !materialPrices.has(ingredient.itemId)).length;
    const total = inputs.reduce((sum, ingredient) => sum + (materialPrices.get(ingredient.itemId) ?? 0) * ingredient.quantity, recipe.laborFee);
    const conditions = normalizeConditions(recipe.conditions);
    return { ...recipe, conditions, requirements: parseRecipeRequirements(conditions), ingredients: inputs, missingPriceCount, materialCost: missingPriceCount ? null : total / recipe.outputYield, productPrice: productPrices.get(recipe.outputItemId) ?? null };
  });
}

function deduplicate(recipesToCheck: RecipeView[]): RecipeView[] {
  const seen = new Set<string>();
  return recipesToCheck.filter((recipe) => {
    const inputs = recipe.ingredients.map((ingredient) => `${ingredient.itemId}:${ingredient.quantity}`).sort().join("|");
    const key = `${recipe.outputItemId}:${recipe.outputYield}:${recipe.profession}:${recipe.masteryTier}:${recipe.laborFee}:${inputs}:${recipe.conditions.slice().sort().join("|")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getCatalogPriceFamily(itemId: string): Promise<CatalogPriceFamily> {
  const [item] = await db.select({ id: catalogItems.id, name: catalogItems.displayName, recordType: catalogItems.recordType }).from(catalogItems).where(eq(catalogItems.id, itemId)).limit(1);
  if (!item) return { canonicalItemId: itemId, displayName: "Catalog item", itemIds: [itemId] };

  const result = await recipeRowsFor(isNotNull(recipes.profession));
  const recipeViews = deduplicate(assemble(result.rows, result.ingredients, new Map(), new Map()));
  const candidates = groupRecipeVariants(recipeViews)
    .filter((group) => group.variants.some((variant) => variant.outputItemId === itemId))
    .sort((left, right) => right.variants.length - left.variants.length);
  const family = candidates[0];
  if (family && family.variants.length > 1) return { canonicalItemId: family.priceReportItemId, displayName: family.displayName, itemIds: family.variants.map((variant) => variant.outputItemId) };

  if (!recipeViews.some((recipe) => recipe.outputItemId === itemId)) {
    const base = itemFamilyBaseName(item.name);
    const possible = await db.select({ id: catalogItems.id, name: catalogItems.displayName }).from(catalogItems)
      .where(and(eq(catalogItems.status, "active"), eq(catalogItems.recordType, item.recordType), ilike(catalogItems.displayName, `${base}%`)));
    const members = possible.filter((candidate) => itemFamilyBaseName(candidate.name).toLocaleLowerCase("en-US") === base.toLocaleLowerCase("en-US"));
    if (members.length > 1) {
      const canonical = members.slice().sort((left, right) => Number(left.name !== base) - Number(right.name !== base) || left.name.localeCompare(right.name))[0];
      return { canonicalItemId: canonical.id, displayName: base, itemIds: members.map((member) => member.id) };
    }
  }
  return { canonicalItemId: itemId, displayName: item.name, itemIds: [itemId] };
}

export const getTailoringPriceFamily = getCatalogPriceFamily;
export type TailoringPriceFamily = CatalogPriceFamily;

export async function getProfessionRecipes(profession: string, storeId?: string) {
  const result = await recipeRowsFor(eq(recipes.profession, profession));
  const [materialPrices, productPrices] = await Promise.all([
    pricesFor([...new Set(result.ingredients.map((ingredient) => ingredient.itemId))], storeId, "store_pays"),
    pricesFor([...new Set(result.rows.map((recipe) => recipe.outputItemId))], storeId, "customer_pays")
  ]);
  return deduplicate(assemble(result.rows, result.ingredients, materialPrices, productPrices)).sort((a, b) => {
    const tier = (a.masteryTier ? MASTERY_TIERS.indexOf(a.masteryTier as (typeof MASTERY_TIERS)[number]) : MASTERY_TIERS.length) - (b.masteryTier ? MASTERY_TIERS.indexOf(b.masteryTier as (typeof MASTERY_TIERS)[number]) : MASTERY_TIERS.length);
    return tier || a.outputName.localeCompare(b.outputName);
  });
}

export async function getCatalogRecipesForItem(itemId: string, storeId?: string, knownPriceFamily?: CatalogPriceFamily) {
  const result = await recipeRowsFor(eq(recipes.outputItemId, itemId));
  const family = knownPriceFamily ?? await getCatalogPriceFamily(itemId);
  const [materialPrices, familyProductPrices] = await Promise.all([
    pricesFor([...new Set(result.ingredients.map((ingredient) => ingredient.itemId))], storeId, "store_pays"),
    pricesFor(family.itemIds, storeId, "customer_pays")
  ]);
  const sharedProductPrice = [...familyProductPrices.values()].reduce<number | null>((highest, price) => highest == null ? price : Math.max(highest, price), null);
  const productPrices = new Map<string, number>();
  if (sharedProductPrice != null) productPrices.set(itemId, sharedProductPrice);
  return deduplicate(assemble(result.rows, result.ingredients, materialPrices, productPrices));
}

export async function getRecipesUsingItem(itemId: string, storeId?: string) {
  const recipeIds = await db.select({ id: recipeIngredients.recipeId }).from(recipeIngredients).where(eq(recipeIngredients.itemId, itemId));
  if (!recipeIds.length) return [];
  const result = await recipeRowsFor(inArray(recipes.id, recipeIds.map((entry) => entry.id)));
  const [materialPrices, productPrices] = await Promise.all([
    pricesFor([...new Set(result.ingredients.map((ingredient) => ingredient.itemId))], storeId, "store_pays"),
    pricesFor([...new Set(result.rows.map((recipe) => recipe.outputItemId))], storeId, "customer_pays")
  ]);
  return deduplicate(assemble(result.rows, result.ingredients, materialPrices, productPrices)).map((recipe) => ({ ...recipe, quantityUsed: recipe.ingredients.find((ingredient) => ingredient.itemId === itemId)?.quantity ?? 0 }));
}
