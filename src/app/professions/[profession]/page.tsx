import { notFound } from "next/navigation";
import { AppShell, PageHeading, Status } from "@/components/app-shell";
import { RecipeRequirements } from "@/components/recipe-requirements";
import { MiningReferenceGuide, SmithingReferenceGuide } from "@/components/profession-reference-guide";
import { resolveStaffPageStore, staffShellIdentity } from "@/components/staff-page-context";
import { getAccessContext } from "@/lib/authorization";
import { formatGold } from "@/lib/money";
import { MASTERY_TIERS, professionBySlug } from "@/lib/professions";
import { getProfessionRecipes } from "@/lib/services/recipe-queries";
import { getMiningReferenceGuide } from "@/lib/services/mining-reference-queries";
import { getSmithingReferenceGuide } from "@/lib/services/smithing-reference-queries";
import { groupRecipeVariants } from "@/lib/tailoring-recipe-groups";

export const dynamic = "force-dynamic";

export default async function ProfessionPage({ params, searchParams }: { params: Promise<{ profession: string }>; searchParams: Promise<{ storeId?: string; view?: string }> }) {
  const profession = professionBySlug((await params).profession);
  if (!profession) notFound();
  const query = await searchParams;
  const context = await getAccessContext();
  const requestedPublicView = query.view === "public" || !context;
  const store = requestedPublicView ? null : await resolveStaffPageStore(query.storeId);
  const publicView = requestedPublicView || !store;
  const [recipeRows, smithingGuide, miningGuide] = await Promise.all([
    getProfessionRecipes(profession.label, store?.id),
    profession.label === "Smithing" ? getSmithingReferenceGuide(store?.id) : null,
    profession.label === "Mining" ? getMiningReferenceGuide() : null,
  ]);
  const displayRows = groupRecipeVariants(recipeRows);
  const smithingItemCount = smithingGuide
    ? smithingGuide.qualities.reduce((sum, quality) => sum + quality.items.length, 0) + recipeRows.filter((recipe) => !smithingGuide.qualities.some((quality) => quality.items.some((item) => item.catalogItem?.id === recipe.outputItemId))).length
    : 0;
  const itemHref = (itemId: string) => store ? `/items/${itemId}${store.storeQuery}` : `/guide/items/${itemId}`;

  const content = <div className="page profession-page">
    <PageHeading eyebrow="PROFESSION" title={profession.label}>
      <p>{profession.label === "Mining" ? "Resources are grouped by the proficiency needed to procure them." : profession.label === "Smithing" ? `${smithingItemCount} smithing items, grouped by mastery. Extracted recipes and additional crafting requirements are shown where Keizaal defines them.` : `${recipeRows.length} extracted craftable items, grouped by mastery${displayRows.length < recipeRows.length ? ` into ${displayRows.length} recipe entries` : ""}. Recipe books, perks, and other additional requirements are shown on each recipe.`}</p>
    </PageHeading>
    {profession.label === "Mining" && miningGuide ? <MiningReferenceGuide guide={miningGuide} itemHref={itemHref} /> : <>
    {smithingGuide ? <SmithingReferenceGuide guide={smithingGuide} recipes={recipeRows} itemHref={itemHref} privateView={Boolean(store)} /> :
    <div className="stack profession-tiers">
      {MASTERY_TIERS.map((tier) => {
        const rows = displayRows.filter((recipe) => recipe.masteryTier === tier);
        const itemCount = rows.reduce((sum, recipe) => sum + recipe.variants.length, 0);
        return <section className="panel" key={tier}>
          <div className="panel-head"><div><p className="eyebrow">MASTERY LEVEL</p><h2>{tier}</h2></div><Status kind={rows.length ? "good" : "pending"}>{rows.length} {displayRows.length < recipeRows.length ? "entries" : "recipes"}{itemCount !== rows.length ? ` · ${itemCount} items` : ""}</Status></div>
          {rows.length ? <div className="table-wrap"><table className="profession-table"><thead><tr><th>Craftable item</th><th>Recipe</th><th>Material cost</th><th>Product price</th></tr></thead><tbody>
            {rows.map((recipe) => <tr key={recipe.id}><td>{recipe.variants.length > 1 ? <details className="tailoring-variants"><summary className="profession-output">{recipe.displayName}<small>{recipe.variants.length} variants · shared price</small></summary><div>{recipe.variants.map((variant) => <a href={itemHref(variant.outputItemId)} key={variant.outputItemId}>{variant.outputName}</a>)}</div></details> : <a className="profession-output" href={itemHref(recipe.outputItemId)}>{recipe.displayName}{recipe.outputYield > 1 && <small> × {recipe.outputYield}</small>}</a>}</td><td><div className="recipe-inputs">{recipe.ingredients.map((ingredient) => <a key={ingredient.itemId} href={itemHref(ingredient.itemId)}>{ingredient.name}{ingredient.unitPrice == null ? "" : ` (${formatGold(ingredient.unitPrice)})`} × {ingredient.quantity}</a>)}</div><RecipeRequirements requirements={recipe.requirements}/></td><td><b>{recipe.materialCost == null ? "Incomplete" : formatGold(recipe.materialCost)}</b>{recipe.missingPriceCount > 0 && <small>{recipe.missingPriceCount} ingredient price{recipe.missingPriceCount === 1 ? "" : "s"} missing</small>}</td><td><b>{recipe.productPrice == null ? "Not priced" : formatGold(recipe.productPrice)}</b><small>{store ? "Store selling price" : "Public Store Price"}</small>{!store && recipe.variants.length > 1 && <a className="profession-report-link" href={`/guide/items/${recipe.priceReportItemId}#market-report`}>Report family price</a>}</td></tr>)}
          </tbody></table></div> : <div className="empty compact-empty"><h3>No {tier.toLowerCase()} recipes found.</h3><p>The current Keizaal catalog does not define any for this profession.</p></div>}
        </section>;
      })}
    </div>
    }
    </>}
    {!store && <p className="market-footnote">Material values use public price information and can be up to 7 days behind real market trends.</p>}
  </div>;
  return publicView
    ? <AppShell current={`/professions/${profession.slug}`} publicView publicAccount={Boolean(context)} searchPublicView={query.view === "public"}>{content}</AppShell>
    : <AppShell current={`/professions/${profession.slug}`} identity={store ? staffShellIdentity(store) : undefined}>{content}</AppShell>;
}
