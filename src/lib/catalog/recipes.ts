import type { BuilderCatalogBundle, CatalogImportIssue } from "./bundle";

export type PreparedCatalogRecipe = { sourceStableKey: string; outputItemId: string; outputYield: number; workbenchKey: string | null; profession: string | null; masteryTier: string | null; laborFee: number; conditions: string[]; sourceReferences: string[]; ingredients: Array<{ itemId: string; quantity: number }> };

/** Maps only completely resolved builder recipes. Missing mappings are administrator-visible, nonblocking findings. */
export function prepareCatalogRecipes(recipes: BuilderCatalogBundle["recipes"], itemIds: ReadonlyMap<string, string>): { recipes: PreparedCatalogRecipe[]; issues: CatalogImportIssue[] } {
  const prepared: PreparedCatalogRecipe[] = []; const issues: CatalogImportIssue[] = [];
  for (const recipe of recipes) {
    const outputItemId = recipe.outputStableKey ? itemIds.get(recipe.outputStableKey.toLowerCase()) : undefined;
    const ingredients: Array<{ itemId: string; quantity: number }> = [];
    if (!outputItemId) issues.push({ stableKey: recipe.stableKey, code: "recipe_mapping_unresolved", blocking: false, detail: "Output stable key is not present in the staged catalog." });
    for (const ingredient of recipe.ingredients) {
      const itemId = ingredient.itemStableKey ? itemIds.get(ingredient.itemStableKey.toLowerCase()) : undefined;
      if (!itemId) issues.push({ stableKey: recipe.stableKey, code: "recipe_mapping_unresolved", blocking: false, detail: `Ingredient ${ingredient.sourceFormKey} is not present in the staged catalog.` });
      else ingredients.push({ itemId, quantity: ingredient.quantity });
    }
    if (!outputItemId || ingredients.length !== recipe.ingredients.length) continue;
    prepared.push({ sourceStableKey: recipe.stableKey, outputItemId, outputYield: recipe.outputYield, workbenchKey: recipe.workbenchKey, profession: recipe.profession, masteryTier: recipe.masteryTier, laborFee: recipe.laborFee ?? 0, conditions: recipe.conditions, sourceReferences: recipe.sources, ingredients });
  }
  return { recipes: prepared, issues };
}
