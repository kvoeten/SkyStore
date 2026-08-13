import { Status } from "@/components/app-shell";
import { RecipeRequirements } from "@/components/recipe-requirements";
import { formatGold } from "@/lib/money";
import { WARMAIDEN_SOURCE_URL } from "@/lib/profession-reference-guides";
import { MASTERY_TIERS } from "@/lib/professions";
import type { RecipeView } from "@/lib/services/recipe-queries";
import type { MiningReferenceGuideView } from "@/lib/services/mining-reference-queries";
import type { SmithingReferenceGuideView } from "@/lib/services/smithing-reference-queries";

export function MiningReferenceGuide({ guide, itemHref }: { guide: MiningReferenceGuideView; itemHref: (itemId: string) => string }) {
  return <div className="stack profession-tiers">{guide.map((group) => <section className="panel" key={group.tier}><div className="panel-head"><div><p className="eyebrow">PROFICIENCY LEVEL</p><h2>{group.tier}</h2></div><Status kind={group.resources.length ? "good" : "pending"}>{group.resources.length} resources</Status></div><div className="table-wrap"><table><thead><tr><th>Resource</th><th>Availability evidence</th><th>Reference value</th></tr></thead><tbody>{group.resources.map((resource) => <tr key={resource.name}><td>{resource.catalogItem ? <a className="profession-output" href={itemHref(resource.catalogItem.id)}>{resource.catalogItem.displayName}</a> : <b>{resource.name}</b>}</td><td><small className="profession-note">{resource.evidence}</small></td><td><b>{formatGold(resource.price)}</b></td></tr>)}</tbody></table></div></section>)}</div>;
}

export function SmithingReferenceGuide({ guide, recipes, itemHref, privateView }: {
  guide: SmithingReferenceGuideView;
  recipes: RecipeView[];
  itemHref: (itemId: string) => string;
  privateView: boolean;
}) {
  const referenceItemIds = new Set(guide.qualities.flatMap((quality) => quality.items.map((item) => item.catalogItem?.id).filter((id): id is string => Boolean(id))));
  return <div className="stack profession-tiers">
    {MASTERY_TIERS.map((tier) => {
      const referenceRows = guide.qualities.filter((quality) => quality.tier === tier).flatMap((quality) => quality.items);
      const additionalRecipes = recipes.filter((recipe) => recipe.masteryTier === tier && !referenceItemIds.has(recipe.outputItemId));
      const entryCount = referenceRows.length + additionalRecipes.length;
      return <section className="panel" key={tier}>
        <div className="panel-head"><div><p className="eyebrow">MASTERY LEVEL</p><h2>{tier}</h2></div><Status kind={entryCount ? "good" : "pending"}>{entryCount} entries</Status></div>
        {entryCount ? <div className="table-wrap"><table className={`profession-table${privateView ? " profession-table-with-buying" : ""}`}>
          <thead><tr><th>Craftable item</th><th>Recipe &amp; notes</th><th>Material cost</th>{privateView && <th>Store buying price</th>}<th>Store Price</th></tr></thead>
          <tbody>
            {referenceRows.map((item) => {
              const recipe = item.catalogItem ? recipes.find((candidate) => candidate.outputItemId === item.catalogItem!.id) : undefined;
              return <tr key={`${tier}:${item.name}`}>
                <td>{item.catalogItem ? <a className="profession-output" href={itemHref(item.catalogItem.id)}>{item.catalogItem.displayName}</a> : <b>{item.name}</b>}</td>
                <td>{recipe ? <RecipeCell recipe={recipe} itemHref={itemHref}/> : <p className="profession-note">Recipe ingredients are not present in the extracted Keizaal data.</p>}<small className="profession-note">{item.referenceNote}</small></td>
                <td><b>{recipe ? recipe.materialCost == null ? "Incomplete" : formatGold(recipe.materialCost) : "Not available"}</b><small>{recipe ? `${recipe.missingPriceCount} ingredient price${recipe.missingPriceCount === 1 ? "" : "s"} missing` : "No extracted recipe"}</small></td>
                {privateView && <td><b>{item.buyingPrice == null ? "Not priced" : formatGold(item.buyingPrice)}</b><small>Store buying price</small></td>}
                <td><b>{formatGold(item.productPrice)}</b><small>Store Price</small></td>
              </tr>;
            })}
            {additionalRecipes.map((recipe) => <tr key={recipe.id}>
              <td><a className="profession-output" href={itemHref(recipe.outputItemId)}>{recipe.outputName}{recipe.outputYield > 1 && <small> × {recipe.outputYield}</small>}</a></td>
              <td><RecipeCell recipe={recipe} itemHref={itemHref}/></td>
              <td><b>{recipe.materialCost == null ? "Incomplete" : formatGold(recipe.materialCost)}</b>{recipe.missingPriceCount > 0 && <small>{recipe.missingPriceCount} ingredient price{recipe.missingPriceCount === 1 ? "" : "s"} missing</small>}</td>
              {privateView && <td><b>Not priced</b><small>Store buying price</small></td>}
              <td><b>{recipe.productPrice == null ? "Not priced" : formatGold(recipe.productPrice)}</b><small>Store Price</small></td>
            </tr>)}
          </tbody>
        </table></div> : <div className="empty compact-empty"><h3>No {tier.toLowerCase()} smithing entries.</h3><p>The active catalog has no reference item or extracted recipe at this level.</p></div>}
      </section>;
    })}
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">COMPLETE OUTFITS</p><h2>Full armor sets</h2></div><Status kind="good">{guide.armorSets.length} sets</Status></div>
      <div className="table-wrap"><table className={`profession-table${privateView ? " profession-table-with-buying" : ""}`}>
        <thead><tr><th>Armor set</th><th>Included pieces</th><th>Material cost</th>{privateView && <th>Store buying price</th>}<th>Store Price</th></tr></thead>
        <tbody>{guide.armorSets.map((set) => <tr key={set.name}>
          <td><b className="profession-output">{set.name}</b><small className="profession-tier-note">{set.tier}</small></td>
          <td><div className="recipe-inputs">{set.components.map((component) => component.catalogItem ? <a key={component.slot} href={itemHref(component.catalogItem.id)}>{component.catalogItem.displayName} ({formatGold(component.price)})</a> : <span key={component.slot}>{component.slot} unavailable</span>)}</div><p className="profession-note">One head, body, hands, and feet piece.</p></td>
          <td><b>Not calculated</b><small>Finished-item bundle</small></td>
          {privateView && <td><b>{set.buyingPrice == null ? "Incomplete" : formatGold(set.buyingPrice)}</b><small>Combined store buying price</small></td>}
          <td><b>{formatGold(set.totalPrice)}</b><small>Full-set Store Price</small></td>
        </tr>)}</tbody>
      </table></div>
      {guide.unresolvedNames.length > 0 && <p className="fine smithing-unresolved">{guide.unresolvedNames.length} reference item{guide.unresolvedNames.length === 1 ? " is" : "s are"} not present in the active catalog.</p>}
      <p className="fine">Source: <a href={WARMAIDEN_SOURCE_URL}>Warmaiden Pricing Ledger</a>.</p>
    </section>
  </div>;
}

function RecipeCell({ recipe, itemHref }: { recipe: RecipeView; itemHref: (itemId: string) => string }) {
  return <><div className="recipe-inputs">{recipe.ingredients.map((ingredient) => <a key={ingredient.itemId} href={itemHref(ingredient.itemId)}>{ingredient.name}{ingredient.unitPrice == null ? "" : ` (${formatGold(ingredient.unitPrice)})`} × {ingredient.quantity}</a>)}</div><RecipeRequirements requirements={recipe.requirements}/></>;
}
