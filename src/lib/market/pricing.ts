export function markupOnCost(sale: number, cost: number): number | null { return cost > 0 ? (sale - cost) / cost : null; }
export function grossMargin(sale: number, cost: number): number | null { return sale > 0 ? (sale - cost) / sale : null; }
export function saleFloor(effectiveCost: number, targetMarkup: number): number { return effectiveCost * (1 + targetMarkup); }

export type RecipeIngredientCost = { quantity: number; acquisitionRate: number | null | undefined };
export function craftReplacementCost(ingredients: Iterable<RecipeIngredientCost>, outputYield: number, laborFee = 0): number | null {
  if (!Number.isInteger(outputYield) || outputYield <= 0 || laborFee < 0) return null;
  let materials = 0;
  for (const ingredient of ingredients) {
    if (!Number.isInteger(ingredient.quantity) || ingredient.quantity <= 0 || ingredient.acquisitionRate == null || ingredient.acquisitionRate < 0) return null;
    materials += ingredient.quantity * ingredient.acquisitionRate;
  }
  return (materials + laborFee) / outputYield;
}

/** Maximum price the store can pay while meeting its target, bounded by cheaper verified replacement. */
export function recommendedMaximumPurchase(expectedSale: number | null | undefined, targetMarkup: number, replacementCost: number | null): number | null {
  if (expectedSale == null || expectedSale < 0 || targetMarkup < 0) return null;
  const saleCeiling = expectedSale / (1 + targetMarkup);
  return replacementCost == null ? saleCeiling : Math.min(saleCeiling, replacementCost);
}
