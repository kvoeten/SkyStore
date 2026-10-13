import Link from "next/link";
import { RecipeRequirements } from "@/components/recipe-requirements";
import { formatGold } from "@/lib/money";
import type { RecipeView } from "@/lib/services/recipe-queries";

export function RecipeCostPanel({ recipe }: { recipe: RecipeView }) {
  return <section className="panel recipe-cost-panel">
    <div className="panel-head"><div><p className="eyebrow">CRAFTING</p><h2>Crafting & material cost</h2></div><span className="recipe-tier">{[recipe.profession, recipe.masteryTier].filter(Boolean).join(" · ")}</span></div>
    <div className="table-wrap"><table><thead><tr><th>Ingredient</th><th>Quantity</th><th>Unit value</th><th>Cost</th></tr></thead><tbody>
      {recipe.ingredients.map((ingredient) => <tr key={ingredient.itemId}><td><Link href={`/guide/items/${ingredient.itemId}`}>{ingredient.name}</Link></td><td>{ingredient.quantity}</td><td>{ingredient.unitPrice == null ? "Not priced" : formatGold(ingredient.unitPrice)}</td><td>{ingredient.unitPrice == null ? "—" : formatGold(ingredient.unitPrice * ingredient.quantity)}</td></tr>)}
      {Number(recipe.laborFee) > 0 && <tr><td>Labor / mastery fee</td><td>—</td><td>—</td><td>{formatGold(Number(recipe.laborFee))}</td></tr>}
    </tbody></table></div>
    <div className="recipe-cost-total"><span>Produces {recipe.outputYield} × {recipe.outputName}</span><strong>Cost per item <b>{recipe.materialCost == null ? "Incomplete" : formatGold(recipe.materialCost)}</b></strong></div>
    {recipe.missingPriceCount > 0 && <p className="fine">{recipe.missingPriceCount} unpriced ingredient{recipe.missingPriceCount === 1 ? "" : "s"}.</p>}
    {recipe.priceBelowMaterialCost && <p className="negative fine">Product price is below material cost — review the price or ingredient values.</p>}
    <RecipeRequirements requirements={recipe.requirements}/>
  </section>;
}
