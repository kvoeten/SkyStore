import { productGroupForItem } from "@/lib/catalog/product-groups";

export type PublishedCatalogItem = { id: string; name: string; category: string; plugin?: string | null };
export type PublishedPriceRule = {
  itemId: string;
  side: "store_pays" | "customer_pays";
  totalSeptims: number;
  quantity: number;
  sourceLabel: string;
  provenanceUrl?: string;
};

const GENERAL_STORE_URL = "https://docs.google.com/spreadsheets/d/1CROFlsMBDYsLMW1ddmPmlZSDTctBfnpEmhBecRBXOIM/htmlview#gid=950121146";
const BLACKSMITH_URL = "https://docs.google.com/spreadsheets/d/1imDMLrwY9YO5ppk-dK8J99dH8SNskpRLzhganWroMzM/edit?gid=1710746180#gid=1710746180";
const TAILORING_URL = "https://docs.google.com/spreadsheets/d/1zO9TlRuXm593sOqXB9Iwpl8lIhymQkZiBpepA3H44Jw/edit?gid=0#gid=0";
const COOKING_URL = "https://docs.google.com/document/d/1OB40xM0uIRMDpaH16ZQj_W06ATzyBA8hXLsseidUpec/edit?usp=sharing";

const generalMenu = "Whiterun General Store menu (imported 2026-08-25)";
const generalProduce = "Whiterun General Store produce intake (imported 2026-08-25)";
const blacksmithRaw = "Whiterun Blacksmith material guide (imported 2026-08-25)";
const tailoringGuide = "Whiterun Tailoring price guide (imported 2026-08-25)";
const currentUpdate = "Whiterun General Store operational update (2026-09-20)";

type ExactRate = readonly [name: string, septims: number, quantity?: number, aliases?: readonly string[]];
type GroupRate = readonly [groupKey: string, septims: number];

// These are the actual published customer prices, not inferred market reports.
const GENERAL_MENU_RATES: readonly ExactRate[] = [
  ["Grilled Chicken", 3, 1, ["Grilled Chicken Breast"]], ["Pheasant Roast", 3], ["Salmon Steak", 3], ["Rabbit Haunch", 3],
  ["Steamed Mudcrab", 3, 1, ["Steamed Mudcrab Legs"]], ["Roasted Goat Leg", 6, 1, ["Leg of Goat Roast"]], ["Mammoth Steak", 9], ["Apple Cabbage Stew", 5],
  ["Beef Stew", 14], ["Cabbage Potato Soup", 5], ["Cabbage Soup", 5], ["Clam Chowder", 18],
  ["Horker and Ash Yam Stew", 8, 1, ["Horker & Ash Yam Stew"]], ["Horker Stew", 10], ["Potato Soup", 5],
  ["Tomato Soup", 8], ["Vegetable Soup", 10], ["Venison Stew", 12], ["Elswyr Fondue", 45],
  ["Mead", 14], ["Ale", 12], ["Wine", 8], ["Apple Dumpling", 10], ["Apple Pie", 24], ["Braided Bread", 7],
  ["Bread", 14], ["Chicken Dumpling", 13], ["Garlic Bread", 26], ["Hardtack Bread", 6],
  ["Jazbay Crostata", 16], ["Juniper Crostata", 17, 1, ["Juniper Berry Crostata"]], ["Potato Bread", 19],
  ["Snowberry Crostata", 16], ["Sweet Roll", 25],
];

// The same sheet lists raw inputs separately. They are store intake values,
// never exposed as public sell prices.
const GENERAL_PRODUCE_RATES: readonly ExactRate[] = [
  ["Red Apple", 0.5], ["Green Apple", 0.5], ["Cabbage", 0.5], ["Carrot", 0.5], ["Leek", 0.5], ["Tomato", 0.5],
  ["Potato", 0.5], ["Garlic", 0.5], ["Lavender", 0.5], ["Salt", 0.5, 1, ["Salt Pile"]], ["Chicken Egg", 0.5, 1, ["Egg", "Chicken's Egg"]],
  ["Milk", 3, 1, ["Jug of Milk"]], ["Wheat", 1], ["Sack of Flour", 3, 1, ["Flour"]], ["Chicken", 0.5], ["Pheasant", 0.5],
  ["Salmon", 0.5], ["Clam", 0.5], ["Rabbit", 0.5], ["Mudcrab", 0.5], ["Venison", 2], ["Horker", 2],
  ["Raw Beef", 3, 1, ["Beef"]], ["Goat Leg", 2, 1, ["Leg of Goat"]], ["Mammoth", 3], ["Honey", 3], ["Jazbay Grapes", 0.25],
  ["Juniper Berries", 0.25], ["Snowberries", 0.25],
];

const BLACKSMITH_MATERIAL_RATES: readonly ExactRate[] = [
  ["Iron Ore", 0.25], ["Corundum Ore", 0.25], ["Silver Ore", 1], ["Gold Ore", 1], ["Orichalcum Ore", 15, 1, ["Orcish Ore"]],
  ["Moonstone Ore", 20], ["Quicksilver Ore", 20], ["Malachite Ore", 1250], ["Ebony Ore", 30000], ["Firewood", 0.25],
  ["Leather", 3], ["Leather Strips", 0.75, 1, ["Leather Strip"]], ["Poor Charcoal", 0.5], ["Charcoal", 1],
  ["Charcoal Briquette", 2.5, 1, ["Charcoal Bricket"]], ["Coke", 5], ["Iron Ingot", 4], ["Corundum Ingot", 6],
  ["Steel Ingot", 8], ["Silver Ingot", 12], ["Gold Ingot", 12], ["Orichalcum Ingot", 105, 1, ["Orcish Ingot"]],
  ["Refined Moonstone", 135, 1, ["Moonstone Ingot"]], ["Quicksilver Ingot", 150], ["Dwarven Metal Ingot", 500, 1, ["Dwemer Ingot", "Dwarven Ingot"]],
  ["Malachite Ingot", 7530, 1, ["Refined Malachite"]], ["Ebony Ingot", 60010], ["Pickaxe", 6], ["Woodcutter's Axe", 6], ["House Key", 20],
  ["Oiled Mail", 60, 1, ["Oiled Mail Hauberk"]], ["Bosmer Mask", 10], ["Bosmer Cape", 10], ["Shoulder Cape", 10, 1, ["Bosmer Shoulder Cape"]], ["Fur Collar", 10],
];

const TAILORING_EXACT_RATES: readonly ExactRate[] = [
  ["Blacksmith's Apron", 15], ["Chef's Tunic", 10], ["Clothes (Basic)", 10], ["Clothes (Mid)", 20],
  ["Fine Clothes", 20], ["Miner's Clothes", 10], ["Ragged Robes", 5], ["Ragged Trousers", 5], ["Roughspun Tunic", 5],
  ["Fine Boots", 25], ["Footwraps", 5], ["Priest Sandals", 25], ["Ragged Boots", 5], ["Shoes", 15], ["Gloves", 15],
  ["Chef's Hat", 10], ["Common Hood", 25], ["Fine Hat", 10], ["Mage Hood", 25], ["Mourner's Hat", 10], ["Ragged Cap", 5], ["Fastened Scarf", 25],
  ["Gathered Scarf", 30], ["Loose Neck Gaiter", 25], ["Quilted Mantle", 35], ["Reinforced Mantle", 35],
  ["Short Woven Scarf", 25], ["Linen Cloak", 35], ["Patchwork Satchel", 40], ["Toothlock Satchel", 45],
  ["Trader's Resource", 50], ["Trader's Resource & Lantern", 65],
];

const TAILORING_GROUP_RATES: readonly GroupRate[] = [
  ["common-clothes", 15], ["common-robes", 25], ["common-robes-hooded", 25], ["fur-capes", 40],
  ["traveller-robes", 15], ["rugged-capes", 25], ["rugged-masks", 15], ["short-cloth-capes", 30], ["cowls", 10],
  ["hats", 10], ["mage-robes", 25], ["priest-robes", 25], ["quilted-surcoats-and-tunics", 30],
];

function normalized(value: string) {
  return value.toLocaleLowerCase("en-US").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function exactBundle(unitSeptims: number, quantity: number) {
  // Source sheets use quarter and half gold values. Persist them as an exact
  // integer bundle, e.g. 0.25g each becomes 1g for 4, so the database never
  // rounds a published price.
  const hundredths = Math.round(unitSeptims * quantity * 100);
  let numerator = hundredths;
  let denominator = 100;
  while (denominator > 1 && numerator % 2 === 0 && denominator % 2 === 0) { numerator /= 2; denominator /= 2; }
  while (denominator > 1 && numerator % 5 === 0 && denominator % 5 === 0) { numerator /= 5; denominator /= 5; }
  return { totalSeptims: numerator, quantity: quantity * denominator };
}

function resolveExact(items: readonly PublishedCatalogItem[], rates: readonly ExactRate[], side: PublishedPriceRule["side"], sourceLabel: string, provenanceUrl: string, resolved: PublishedPriceRule[], unresolved: string[]) {
  const byName = new Map<string, PublishedCatalogItem[]>();
  for (const item of items) byName.set(normalized(item.name), [...(byName.get(normalized(item.name)) ?? []), item]);
  for (const [name, septims, quantity = 1, aliases = []] of rates) {
    const matches = [name, ...aliases].flatMap((candidate) => byName.get(normalized(candidate)) ?? []);
    const unique = [...new Map(matches.map((item) => [item.id, item])).values()];
    if (!unique.length) { unresolved.push(`${sourceLabel}: ${name}`); continue; }
    const bundle = exactBundle(septims, quantity);
    for (const item of unique) resolved.push({ itemId: item.id, side, ...bundle, sourceLabel, provenanceUrl });
  }
}

type PredicateRate = { label: string; side: PublishedPriceRule["side"]; septims: number; quantity?: number; matches: (item: PublishedCatalogItem) => boolean };

const operationalRates: readonly PredicateRate[] = [
  { label: "Blackberry reserve", side: "customer_pays", septims: 250, matches: (item) => normalized(item.name) === "blackberry reserve" },
  { label: "Blackberry mead", side: "customer_pays", septims: 100, matches: (item) => normalized(item.name) === "blackberry mead" },
  { label: "Iron and Corundum ore", side: "store_pays", septims: .1, quantity: 10, matches: (item) => /^(iron|corundum) ore$/.test(normalized(item.name)) },
  { label: "Iron and Corundum ore", side: "customer_pays", septims: 2, matches: (item) => /^(iron|corundum) ore$/.test(normalized(item.name)) },
  { label: "Minor restorative potion", side: "store_pays", septims: 8, matches: (item) => /potion/.test(normalized(item.name)) && /(healing|stamina|magicka|magika)/.test(normalized(item.name)) && /(minor|lesser)/.test(normalized(item.name)) },
  { label: "Medium restorative potion", side: "store_pays", septims: 12, matches: (item) => /potion/.test(normalized(item.name)) && /(healing|stamina|magicka|magika)/.test(normalized(item.name)) && !/(minor|lesser|greater|extreme|ultimate)/.test(normalized(item.name)) },
  { label: "Greater restorative potion", side: "store_pays", septims: 20, matches: (item) => /potion/.test(normalized(item.name)) && /(healing|stamina|magicka|magika)/.test(normalized(item.name)) && /(greater|extreme|ultimate)/.test(normalized(item.name)) },
  { label: "Minor restorative potion", side: "customer_pays", septims: 16, matches: (item) => /potion/.test(normalized(item.name)) && /(healing|stamina|magicka|magika)/.test(normalized(item.name)) && /(minor|lesser)/.test(normalized(item.name)) },
  { label: "Medium restorative potion", side: "customer_pays", septims: 24, matches: (item) => /potion/.test(normalized(item.name)) && /(healing|stamina|magicka|magika)/.test(normalized(item.name)) && !/(minor|lesser|greater|extreme|ultimate)/.test(normalized(item.name)) },
  { label: "Greater restorative potion", side: "customer_pays", septims: 40, matches: (item) => /potion/.test(normalized(item.name)) && /(healing|stamina|magicka|magika)/.test(normalized(item.name)) && /(greater|extreme|ultimate)/.test(normalized(item.name)) },
  { label: "Other potions", side: "store_pays", septims: 5, matches: (item) => /potion/.test(normalized(item.name)) && !/(healing|stamina|magicka|magika)/.test(normalized(item.name)) },
  { label: "Other potions", side: "customer_pays", septims: 20, matches: (item) => /potion/.test(normalized(item.name)) && !/(healing|stamina|magicka|magika)/.test(normalized(item.name)) },
  { label: "Alchemy ingredients", side: "store_pays", septims: .1, quantity: 10, matches: (item) => item.category === "Alchemy ingredients" || /tundra cotton/.test(normalized(item.name)) },
  { label: "Raw meat", side: "store_pays", septims: .25, quantity: 4, matches: (item) => /raw/.test(normalized(item.name)) && /(meat|beef|venison|goat|rabbit|chicken|pheasant|mammoth|horker)/.test(normalized(item.name)) },
  { label: "Venison and beef", side: "store_pays", septims: 1, matches: (item) => /^(venison|raw beef|beef)$/.test(normalized(item.name)) },
  { label: "Wolf pelt", side: "customer_pays", septims: 1, matches: (item) => /wolf pelt/.test(normalized(item.name)) },
  { label: "Sabre cat pelt", side: "customer_pays", septims: 3, matches: (item) => /sabre cat pelt/.test(normalized(item.name)) },
  { label: "Bear pelt", side: "customer_pays", septims: 5, matches: (item) => /bear pelt/.test(normalized(item.name)) },
  { label: "Other animal pelts", side: "customer_pays", septims: 1, matches: (item) => /(pelt|hide)/.test(normalized(item.name)) && !/(wolf|sabre cat|bear)/.test(normalized(item.name)) },
  { label: "Cloaks", side: "store_pays", septims: 15, matches: (item) => /cloak/.test(normalized(item.name)) },
  { label: "Cloaks", side: "customer_pays", septims: 50, matches: (item) => /cloak/.test(normalized(item.name)) },
  { label: "Ancient Nord weapons", side: "customer_pays", septims: 1, matches: (item) => /ancient nord/.test(normalized(item.name)) && item.category === "Weapons" },
  { label: "Garnets", side: "customer_pays", septims: 1, matches: (item) => /garnet/.test(normalized(item.name)) && !/flawless/.test(normalized(item.name)) },
  { label: "Diamonds", side: "customer_pays", septims: 5, matches: (item) => /diamond/.test(normalized(item.name)) && !/flawless/.test(normalized(item.name)) },
  { label: "Flawless gems", side: "customer_pays", septims: 15, matches: (item) => /flawless/.test(normalized(item.name)) && /gem|garnet|diamond|ruby|sapphire|amethyst|emerald/.test(normalized(item.name)) },
  { label: "Other gems", side: "customer_pays", septims: 2, matches: (item) => /(gem|amethyst|ruby|sapphire|emerald)/.test(normalized(item.name)) && !/(garnet|diamond|flawless)/.test(normalized(item.name)) },
  { label: "Wheat", side: "store_pays", septims: .5, quantity: 2, matches: (item) => normalized(item.name) === "wheat" },
  { label: "Wheat", side: "customer_pays", septims: 3, quantity: 2, matches: (item) => normalized(item.name) === "wheat" },
  { label: "Empty soul gems", side: "store_pays", septims: 4, matches: (item) => /soul gem/.test(normalized(item.name)) && !/filled/.test(normalized(item.name)) },
  { label: "Filled soul gems", side: "store_pays", septims: 6, matches: (item) => /soul gem/.test(normalized(item.name)) && /filled/.test(normalized(item.name)) },
  { label: "Empty soul gems", side: "customer_pays", septims: 8, matches: (item) => /soul gem/.test(normalized(item.name)) && !/filled/.test(normalized(item.name)) },
  { label: "Filled soul gems", side: "customer_pays", septims: 15, matches: (item) => /soul gem/.test(normalized(item.name)) && /filled/.test(normalized(item.name)) },
  { label: "Leather", side: "store_pays", septims: 2, matches: (item) => normalized(item.name) === "leather" },
  { label: "Leather", side: "customer_pays", septims: 4, matches: (item) => normalized(item.name) === "leather" },
  { label: "Leather strips", side: "store_pays", septims: .5, quantity: 4, matches: (item) => /^leather strips?$/.test(normalized(item.name)) },
  { label: "Leather strips", side: "customer_pays", septims: 4, matches: (item) => /^leather strips?$/.test(normalized(item.name)) },
  { label: "Jewelry", side: "customer_pays", septims: 1, matches: (item) => item.category === "Jewelry" },
  { label: "Moon sugar", side: "customer_pays", septims: 10, matches: (item) => normalized(item.name) === "moon sugar" },
  { label: "Lockpicks", side: "customer_pays", septims: 5, matches: (item) => /lockpick/.test(normalized(item.name)) },
  { label: "Spell tomes", side: "customer_pays", septims: 10, matches: (item) => item.category === "Spell tomes" },
  { label: "Readable books", side: "customer_pays", septims: 15, matches: (item) => item.category === "Books & scrolls" },
  { label: "Moonstone ore", side: "store_pays", septims: 15, matches: (item) => normalized(item.name) === "moonstone ore" },
  { label: "Quicksilver ore", side: "store_pays", septims: 15, matches: (item) => normalized(item.name) === "quicksilver ore" },
  { label: "Orichalcum ore", side: "store_pays", septims: 10, matches: (item) => /^(orichalcum|orcish) ore$/.test(normalized(item.name)) },
  { label: "Gold and silver ore", side: "store_pays", septims: .05, matches: (item) => /^(gold|silver) ore$/.test(normalized(item.name)) },
  { label: "Skooma", side: "customer_pays", septims: 50, matches: (item) => normalized(item.name) === "skooma" }
];

function resolvePredicateRates(items: readonly PublishedCatalogItem[], resolved: PublishedPriceRule[]) {
  for (const rate of operationalRates) {
    const bundle = exactBundle(rate.septims, rate.quantity ?? 1);
    for (const item of items.filter(rate.matches)) {
      // This is a dated operating update. It deliberately supersedes an older
      // guide for the same item and direction, even when the new rate is lower.
      for (let index = resolved.length - 1; index >= 0; index--) if (resolved[index].itemId === item.id && resolved[index].side === rate.side) resolved.splice(index, 1);
      resolved.push({ itemId: item.id, side: rate.side, ...bundle, sourceLabel: `${currentUpdate}: ${rate.label}` });
    }
  }
}

/** Resolve only names and family rules that are explicitly present in the source guides. */
export function resolvePublishedPriceGuide(items: readonly PublishedCatalogItem[]) {
  const resolved: PublishedPriceRule[] = [];
  const unresolved: string[] = [];
  resolveExact(items, GENERAL_MENU_RATES, "customer_pays", generalMenu, COOKING_URL, resolved, unresolved);
  resolveExact(items, GENERAL_PRODUCE_RATES, "store_pays", generalProduce, GENERAL_STORE_URL, resolved, unresolved);
  resolveExact(items, BLACKSMITH_MATERIAL_RATES, "store_pays", blacksmithRaw, BLACKSMITH_URL, resolved, unresolved);
  resolveExact(items, TAILORING_EXACT_RATES, "customer_pays", tailoringGuide, TAILORING_URL, resolved, unresolved);
  for (const [groupKey, septims] of TAILORING_GROUP_RATES) {
    const matches = items.filter((item) => productGroupForItem(item)?.key === groupKey);
    if (!matches.length) unresolved.push(`${tailoringGuide}: ${groupKey}`);
    const bundle = exactBundle(septims, 1);
    for (const item of matches) resolved.push({ itemId: item.id, side: "customer_pays", ...bundle, sourceLabel: `${tailoringGuide}: ${productGroupForItem(item)!.label}`, provenanceUrl: TAILORING_URL });
  }
  resolvePredicateRates(items, resolved);
  const unique = new Map<string, PublishedPriceRule>();
  for (const rule of resolved) unique.set(`${rule.itemId}:${rule.side}:${rule.sourceLabel}`, rule);
  return { rules: [...unique.values()], unresolved: [...new Set(unresolved)] };
}
