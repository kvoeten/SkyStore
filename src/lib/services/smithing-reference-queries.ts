import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db/runtime";
import { catalogItems, officialPriceRules } from "@/db/schema";
import { SMITHING_ARMOR_SETS, SMITHING_REFERENCE_QUALITIES } from "@/lib/profession-reference-guides";

export type SmithingCatalogItem = { id: string; displayName: string };
export type SmithingReferenceGuideView = {
  qualities: Array<{
    quality: string;
    tier: string;
    items: Array<{ name: string; productPrice: number; referenceNote: string; buyingPrice: number | null; catalogItem: SmithingCatalogItem | null }>;
  }>;
  armorSets: Array<{
    name: string;
    tier: string;
    totalPrice: number;
    buyingPrice: number | null;
    components: Array<{ slot: string; price: number; buyingPrice: number | null; catalogItem: SmithingCatalogItem | null }>;
  }>;
  unresolvedNames: string[];
};

const PLUGIN_PRIORITY = ["skyrim.esm", "sentinel.esp"];

export async function getSmithingReferenceGuide(storeId?: string): Promise<SmithingReferenceGuideView> {
  const targetNames = [...new Set([
    ...SMITHING_REFERENCE_QUALITIES.flatMap((quality) => quality.items.map((item) => item.catalogName)),
    ...SMITHING_ARMOR_SETS.flatMap((set) => set.components.map((component) => component.catalogName)),
  ])];
  const rows = await db.select({
    id: catalogItems.id,
    displayName: catalogItems.displayName,
    plugin: catalogItems.plugin,
    stableKey: catalogItems.stableKey,
  }).from(catalogItems).where(and(eq(catalogItems.status, "active"), inArray(catalogItems.displayName, targetNames)));

  const resolved = new Map<string, SmithingCatalogItem>();
  for (const name of targetNames) {
    const match = rows.filter((row) => row.displayName === name).sort((left, right) => {
      const leftPriority = pluginPriority(left.plugin);
      const rightPriority = pluginPriority(right.plugin);
      return leftPriority - rightPriority || left.stableKey.localeCompare(right.stableKey);
    })[0];
    if (match) resolved.set(name, { id: match.id, displayName: match.displayName });
  }
  const buyingPrices = storeId ? await getStoreBuyingPrices([...resolved.values()].map((item) => item.id), storeId) : new Map<string, number>();

  return {
    qualities: SMITHING_REFERENCE_QUALITIES.map((quality) => ({
      quality: quality.quality,
      tier: quality.tier,
      items: quality.items.map((item) => {
        const catalogItem = resolved.get(item.catalogName) ?? null;
        return {
          name: item.name,
          productPrice: item.price / item.priceQuantity,
          referenceNote: item.priceQuantity > 1 ? `Unit price calculated from a ${item.priceQuantity}-item ledger rate.` : "Blacksmith ledger reference price.",
          buyingPrice: catalogItem ? buyingPrices.get(catalogItem.id) ?? null : null,
          catalogItem,
        };
      }),
    })),
    armorSets: SMITHING_ARMOR_SETS.map((set) => {
      const components = set.components.map((component) => {
        const catalogItem = resolved.get(component.catalogName) ?? null;
        return { ...component, buyingPrice: catalogItem ? buyingPrices.get(catalogItem.id) ?? null : null, catalogItem };
      });
      const buyingPrice = components.every((component) => component.buyingPrice != null)
        ? components.reduce((sum, component) => sum + component.buyingPrice!, 0)
        : null;
      return { name: set.name, tier: set.tier, totalPrice: set.totalPrice, components, buyingPrice };
    }),
    unresolvedNames: targetNames.filter((name) => !resolved.has(name)),
  } satisfies SmithingReferenceGuideView;
}

async function getStoreBuyingPrices(itemIds: string[], storeId: string) {
  const prices = new Map<string, number>();
  if (!itemIds.length) return prices;
  const now = new Date();
  const rules = await db.select().from(officialPriceRules).where(and(
    inArray(officialPriceRules.itemId, itemIds),
    eq(officialPriceRules.side, "store_pays"),
    or(isNull(officialPriceRules.storeId), eq(officialPriceRules.storeId, storeId)),
    lte(officialPriceRules.effectiveFrom, now),
    or(isNull(officialPriceRules.effectiveTo), gte(officialPriceRules.effectiveTo, now)),
  ));
  for (const rule of rules.sort((left, right) => Number(left.storeId === storeId) - Number(right.storeId === storeId))) {
    if (rule.quantity > 0) prices.set(rule.itemId, rule.maximumSeptims / rule.quantity);
  }
  return prices;
}

function pluginPriority(plugin: string | null) {
  const index = PLUGIN_PRIORITY.indexOf(plugin?.toLocaleLowerCase("en-US") ?? "");
  return index === -1 ? PLUGIN_PRIORITY.length : index;
}
