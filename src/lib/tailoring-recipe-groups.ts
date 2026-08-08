type GroupableRecipe = {
  id: string;
  outputItemId: string;
  outputName: string;
  outputYield: number;
  masteryTier: string | null;
  laborFee: number;
  conditions: string[];
  ingredients: Array<{ itemId: string; quantity: number }>;
  materialCost: number | null;
  productPrice: number | null;
  missingPriceCount: number;
};

export type TailoringRecipeGroup<T extends GroupableRecipe> = T & {
  displayName: string;
  variants: T[];
  priceReportItemId: string;
};

type NumberedName = { base: string; number: number; rawNumber: string };

function numberedName(name: string): NumberedName | null {
  const match = name.trim().match(/^(.*\S)\s+(\d+)$/);
  if (!match) return null;
  return { base: match[1], number: Number(match[2]), rawNumber: match[2] };
}

function recipeSignature(recipe: GroupableRecipe, base: string) {
  const ingredients = recipe.ingredients.map((ingredient) => `${ingredient.itemId}:${ingredient.quantity}`).sort().join("|");
  return [
    base.toLocaleLowerCase("en-US"), recipe.masteryTier, recipe.outputYield, recipe.laborFee,
    ingredients, recipe.conditions.slice().sort().join("|"),
  ].join("::");
}

function rangeLabel(base: string, names: NumberedName[]) {
  const ordered = names.slice().sort((a, b) => a.number - b.number);
  const width = Math.max(...ordered.map((name) => name.rawNumber.length));
  const first = ordered[0].number.toString().padStart(width, "0");
  const last = ordered.at(-1)!.number.toString().padStart(width, "0");
  return `${base} ${first}–${last}`;
}

export function groupTailoringRecipeVariants<T extends GroupableRecipe>(recipes: T[]): TailoringRecipeGroup<T>[] {
  const groups = new Map<string, Array<{ recipe: T; name: NumberedName }>>();
  const singles: Array<{ index: number; recipe: T }> = [];

  recipes.forEach((recipe, index) => {
    const name = numberedName(recipe.outputName);
    if (!name) {
      singles.push({ index, recipe });
      return;
    }
    const key = recipeSignature(recipe, name.base);
    groups.set(key, [...(groups.get(key) ?? []), { recipe, name }]);
  });

  const rows: Array<{ index: number; group: TailoringRecipeGroup<T> }> = singles.map(({ index, recipe }) => ({
    index, group: { ...recipe, displayName: recipe.outputName, variants: [recipe], priceReportItemId: recipe.outputItemId },
  }));

  for (const variants of groups.values()) {
    const sorted = variants.slice().sort((a, b) => a.name.number - b.name.number || a.recipe.outputName.localeCompare(b.recipe.outputName));
    const firstIndex = recipes.findIndex((recipe) => recipe.id === sorted[0].recipe.id);
    if (sorted.length === 1) {
      rows.push({ index: firstIndex, group: { ...sorted[0].recipe, displayName: sorted[0].recipe.outputName, variants: [sorted[0].recipe], priceReportItemId: sorted[0].recipe.outputItemId } });
      continue;
    }
    const sharedProductPrice = sorted.reduce<number | null>((highest, variant) => {
      const price = variant.recipe.productPrice;
      return price == null ? highest : highest == null ? price : Math.max(highest, price);
    }, null);
    rows.push({
      index: firstIndex,
      group: {
        ...sorted[0].recipe,
        displayName: rangeLabel(sorted[0].name.base, sorted.map((variant) => variant.name)),
        variants: sorted.map((variant) => variant.recipe),
        priceReportItemId: sorted[0].recipe.outputItemId,
        productPrice: sharedProductPrice,
      },
    });
  }

  return rows.sort((a, b) => a.index - b.index).map((row) => row.group);
}
