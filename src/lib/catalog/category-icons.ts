export type CategoryIconItem = {
  name: string;
  category: string;
  editorId?: string | null;
};

function normalized(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKD").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Flat category art is used in dense lists; item-specific renders are reserved for detail pages. */
export function categoryIconPath(item: CategoryIconItem): string {
  const category = normalized(item.category);
  const identity = normalized(`${item.name} ${item.editorId ?? ""}`);

  if (/\bingot\b/.test(identity)) return "/catalog-icons/ingot.png";
  if (/\bore\b/.test(identity)) return "/catalog-icons/ore.png";
  if (/(alchemy|ingredient|flora|flower)/.test(category)) return "/catalog-icons/flower.png";
  if (/(potion|poison)/.test(category)) return "/catalog-icons/potion.png";
  if (/(food|drink)/.test(category)) return "/catalog-icons/food.png";
  if (/(armor|armour|clothing|apparel|jewel)/.test(category)) return "/catalog-icons/armor.png";
  if (/(weapon|ammunition|ammo)/.test(category)) return "/catalog-icons/weapon.png";
  if (/(book|scroll|spell|tome)/.test(category)) return "/catalog-icons/book.png";
  if (/(ore|mineral)/.test(category)) return "/catalog-icons/ore.png";
  if (/ingot/.test(category)) return "/catalog-icons/ingot.png";
  return "/catalog-icons/misc.png";
}
