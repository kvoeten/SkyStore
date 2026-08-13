import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/runtime";
import { catalogItems, officialPriceRules } from "@/db/schema";
import { categoryIconPath } from "@/lib/catalog/category-icons";
import { collapseItemFamilies } from "@/lib/catalog/item-families";
import { effectiveMarketCategory, type MarketCategorySlug } from "@/lib/catalog/market-categories";
import { getPublicMarketOverview } from "@/lib/public-market";

export async function getMarketCategoryItems(category: MarketCategorySlug, storeId?: string) {
  const raw = await db.select({
    id: catalogItems.id, name: catalogItems.displayName, category: catalogItems.category, marketCategory: catalogItems.marketCategory,
    editorId: catalogItems.editorId, recordType: catalogItems.recordType,
    craftSignature: sql<string | null>`(
      select string_agg(ri.item_id::text || ':' || ri.quantity::text, '|' order by ri.item_id::text)
      from recipes category_recipe join recipe_ingredients ri on ri.recipe_id = category_recipe.id
      where category_recipe.output_item_id = ${catalogItems.id} and category_recipe.approval = 'approved' and category_recipe.is_catalog_default = true
    )`
  }).from(catalogItems).where(eq(catalogItems.status, "active")).orderBy(catalogItems.displayName);
  const families = collapseItemFamilies(raw.filter((item) => effectiveMarketCategory(item) === category));
  const familyItemIds = [...new Set(families.flatMap((family) => family.familyItemIds))];
  const prices = new Map<string, { buying: number | null; selling: number | null }>();

  if (storeId && familyItemIds.length) {
    const now = new Date();
    const rules = await db.select().from(officialPriceRules).where(and(
      inArray(officialPriceRules.itemId, familyItemIds), or(isNull(officialPriceRules.storeId), eq(officialPriceRules.storeId, storeId)),
      lte(officialPriceRules.effectiveFrom, now), or(isNull(officialPriceRules.effectiveTo), gte(officialPriceRules.effectiveTo, now))
    )).orderBy(desc(officialPriceRules.effectiveFrom));
    for (const rule of rules) {
      const current = prices.get(rule.itemId) ?? { buying: null, selling: null };
      const unit = rule.maximumSeptims / rule.quantity;
      if (rule.side === "store_pays") current.buying = Math.max(current.buying ?? 0, unit);
      else current.selling = Math.max(current.selling ?? 0, unit);
      prices.set(rule.itemId, current);
    }
  } else {
    const overview = await getPublicMarketOverview();
    for (const rule of overview?.official ?? []) if (rule.quantity[0] > 0) prices.set(rule.itemId, { buying: null, selling: rule.septims[1] / rule.quantity[0] });
    for (const estimate of overview?.estimates ?? []) {
      const selling = Number(estimate.upperQuartile ?? estimate.median);
      if (Number.isFinite(selling)) prices.set(estimate.itemId, { buying: null, selling });
    }
  }

  return families.map((family) => {
    const familyPrices = family.familyItemIds.map((id) => prices.get(id)).filter(Boolean);
    return {
      itemId: family.id,
      name: family.familyName,
      catalogCategory: family.category ?? "Miscellaneous",
      imageUrl: categoryIconPath({ name: family.familyName, category: family.category ?? "Miscellaneous", editorId: family.editorId }),
      buyingPrice: highest(familyPrices.map((price) => price!.buying)),
      sellingPrice: highest(familyPrices.map((price) => price!.selling)),
      variantCount: family.familyItemIds.length,
    };
  }).sort((left, right) => Number(right.sellingPrice != null) - Number(left.sellingPrice != null) || left.name.localeCompare(right.name));
}

function highest(values: Array<number | null>) {
  const priced = values.filter((value): value is number => value != null);
  return priced.length ? Math.max(...priced) : null;
}
