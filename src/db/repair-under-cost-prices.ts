import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { createDatabase } from "./index";
import { getBaseCostsFor } from "@/lib/services/recipe-queries";
import { auditEvents, catalogItems, officialPriceRules, recipeIngredients, recipes } from "./schema";

export const MATERIAL_COST_BASELINE_LABEL = "SkyStore material-cost baseline correction (2026-10-13)";

/**
 * One-time repair for the imported reference sheets. It raises only currently
 * published store-sale references that are below a complete recipe cost. It
 * deliberately does not run again after the baseline exists: later market
 * movement remains visible as a warning in the product UI rather than being
 * silently rewritten.
 */
export async function installMaterialCostBaseline(storeId: string) {
  const { db, client } = createDatabase();
  const baselineAt = new Date();
  try {
    const existing = await db.select({ id: officialPriceRules.id }).from(officialPriceRules).where(and(
      eq(officialPriceRules.storeId, storeId),
      eq(officialPriceRules.sourceLabel, MATERIAL_COST_BASELINE_LABEL)
    )).limit(1);
    if (existing.length) return { repaired: 0, incomplete: 0 };

    const recipeRows = await db.select({ id: recipes.id, outputItemId: recipes.outputItemId, outputYield: recipes.outputYield, laborFee: recipes.laborFee })
      .from(recipes).innerJoin(catalogItems, eq(recipes.outputItemId, catalogItems.id))
      .where(and(eq(recipes.approval, "approved"), eq(recipes.isCatalogDefault, true), isNull(recipes.storeId), eq(catalogItems.status, "active")));
    const ingredients = recipeRows.length ? await db.select({ recipeId: recipeIngredients.recipeId, itemId: recipeIngredients.itemId, quantity: recipeIngredients.quantity })
      .from(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeRows.map((recipe) => recipe.id))) : [];
    const costs = await getBaseCostsFor([...new Set(ingredients.map((ingredient) => ingredient.itemId))]);
    const targetByItem = new Map<string, number>();
    let incomplete = 0;
    for (const recipe of recipeRows) {
      const inputs = ingredients.filter((ingredient) => ingredient.recipeId === recipe.id);
      if (!inputs.length || inputs.some((ingredient) => !costs.has(ingredient.itemId))) { incomplete++; continue; }
      const materialCost = inputs.reduce((sum, ingredient) => sum + (costs.get(ingredient.itemId) ?? 0) * ingredient.quantity, recipe.laborFee) / recipe.outputYield;
      targetByItem.set(recipe.outputItemId, Math.max(targetByItem.get(recipe.outputItemId) ?? 0, Math.ceil(materialCost)));
    }
    if (!targetByItem.size) return { repaired: 0, incomplete };

    const now = new Date();
    const activeSales = await db.select().from(officialPriceRules).where(and(
      eq(officialPriceRules.storeId, storeId),
      eq(officialPriceRules.side, "customer_pays"),
      inArray(officialPriceRules.itemId, [...targetByItem.keys()]),
      lte(officialPriceRules.effectiveFrom, now),
      or(isNull(officialPriceRules.effectiveTo), gt(officialPriceRules.effectiveTo, now))
    ));
    const currentByItem = new Map<string, number>();
    for (const rule of activeSales) currentByItem.set(rule.itemId, Math.max(currentByItem.get(rule.itemId) ?? 0, rule.maximumSeptims / rule.quantity));
    const corrections = [...targetByItem.entries()].filter(([itemId, target]) => (currentByItem.get(itemId) ?? Infinity) < target);
    if (!corrections.length) return { repaired: 0, incomplete };

    await db.transaction(async (tx) => {
      const itemIds = corrections.map(([itemId]) => itemId);
      await tx.update(officialPriceRules).set({ effectiveTo: baselineAt }).where(and(
        eq(officialPriceRules.storeId, storeId),
        eq(officialPriceRules.side, "customer_pays"),
        inArray(officialPriceRules.itemId, itemIds),
        isNull(officialPriceRules.effectiveTo),
        lte(officialPriceRules.effectiveFrom, baselineAt)
      ));
      await tx.insert(officialPriceRules).values(corrections.map(([itemId, target]) => ({
        storeId, itemId, side: "customer_pays" as const,
        minimumSeptims: target, maximumSeptims: target, quantity: 1, maximumQuantity: 1,
        effectiveFrom: baselineAt, sourceLabel: MATERIAL_COST_BASELINE_LABEL, createdBy: null
      })));
      await tx.insert(auditEvents).values({ actorId: null, storeId, action: "official_prices.material_cost_baseline", entityType: "official_price_import", after: { repaired: corrections.length, incomplete } });
    });
    return { repaired: corrections.length, incomplete };
  } finally {
    await client.end();
  }
}
