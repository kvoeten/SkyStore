export type ProductGroupItem = {
  name: string;
  category?: string | null;
  plugin?: string | null;
};

export type ProductGroup = {
  key: string;
  label: string;
  marketCategory: "tailoring" | "smithing" | "farm-produce";
  matches: (item: ProductGroupItem) => boolean;
};

const nameOf = (item: ProductGroupItem) => item.name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

/** Product families stated explicitly by the published price guides. */
export const PRODUCT_GROUPS: readonly ProductGroup[] = [
  { key: "common-clothes", label: "Common Clothes", marketCategory: "tailoring", matches: (item) => /^common clothes \d+$/i.test(nameOf(item)) },
  { key: "common-robes", label: "Common Robes", marketCategory: "tailoring", matches: (item) => /^common robes \d+$/i.test(nameOf(item)) },
  { key: "common-robes-hooded", label: "Common Robes Hooded", marketCategory: "tailoring", matches: (item) => /^common robes hooded \d+$/i.test(nameOf(item)) },
  { key: "fur-capes", label: "Fur Capes", marketCategory: "tailoring", matches: (item) => /^fur cloak \((?:black|brown|snowy sabre|vale sabre|white)\)$/i.test(nameOf(item)) },
  { key: "traveller-robes", label: "Traveller Robes", marketCategory: "tailoring", matches: (item) => /^traveller robes (?:black|brown|grey|red|tan)(?: hooded)?$/i.test(nameOf(item)) },
  { key: "rugged-capes", label: "Rugged Capes", marketCategory: "tailoring", matches: (item) => nameOf(item) === "rugged cape" },
  { key: "rugged-masks", label: "Rugged Masks", marketCategory: "tailoring", matches: (item) => nameOf(item) === "rugged mask" },
  { key: "short-cloth-capes", label: "Short Cloth Capes", marketCategory: "tailoring", matches: (item) => nameOf(item) === "short cloth cape" },
  { key: "cowls", label: "Cowls", marketCategory: "tailoring", matches: (item) => /^(?:black|blue|brown|green|grey|monk|necromancer|red )?cowl$/i.test(nameOf(item)) },
  { key: "hats", label: "Hats", marketCategory: "tailoring", matches: (item) => nameOf(item) === "hat" },
  { key: "mage-robes", label: "Mage Robes", marketCategory: "tailoring", matches: (item) => /^mage robes(?: variant)?$/i.test(nameOf(item)) },
  { key: "priest-robes", label: "Priest Robes", marketCategory: "tailoring", matches: (item) => /^(?:black )?priest robes$/i.test(nameOf(item)) },
  { key: "quilted-surcoats-and-tunics", label: "Quilted Surcoats & Tunics", marketCategory: "tailoring", matches: (item) => /^(?:heavy )?quilted (?:surcoat|tunic)(?:\s+\d+)?$/i.test(nameOf(item)) || /^quilted tunic (?:and|with) /i.test(nameOf(item)) },
];

export function productGroupForItem(item: ProductGroupItem): ProductGroup | null {
  return PRODUCT_GROUPS.find((group) => group.matches(item)) ?? null;
}
