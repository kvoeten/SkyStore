export const MARKET_CATEGORIES = [
  { slug: "farm-produce", label: "Farm Produce", description: "Crops, orchard produce, eggs, milk, and other farm goods." },
  { slug: "hunting-loot", label: "Hunting Loot", description: "Meat, hides, pelts, antlers, claws, teeth, and other animal goods." },
  { slug: "dungeon-loot", label: "Dungeon Loot", description: "Gems, soul gems, ancient equipment, and valuables recovered from ruins." },
  { slug: "foraging-loot", label: "Foraging Loot", description: "Flowers, mushrooms, roots, berries, and wild alchemical ingredients." },
] as const;

export type MarketCategorySlug = (typeof MARKET_CATEGORIES)[number]["slug"];

export function marketCategoryBySlug(slug: string) {
  return MARKET_CATEGORIES.find((category) => category.slug === slug);
}

export function effectiveMarketCategory(item: { marketCategory?: string | null; name: string; category: string; recordType?: string | null; editorId?: string | null }): MarketCategorySlug | null {
  if (item.marketCategory && MARKET_CATEGORIES.some((category) => category.slug === item.marketCategory)) return item.marketCategory as MarketCategorySlug;
  return inferMarketCategory(item);
}

export function inferMarketCategory(item: { name: string; category: string; recordType?: string | null; editorId?: string | null }): MarketCategorySlug | null {
  const text = `${item.name} ${item.editorId ?? ""} ${item.category} ${item.recordType ?? ""}`.toLocaleLowerCase("en-US");
  const recordType = item.recordType?.toLocaleLowerCase("en-US") ?? "";
  if (["book", "furniture", "tree", "flora", "light"].includes(recordType)) return null;
  const name = item.name.trim().toLocaleLowerCase("en-US").replace(/(?:\s+\d+|\s*\(\d+\))$/, "");
  const farmNames = new Set(["wheat", "potato", "potatoes", "tomato", "cabbage", "leek", "carrot", "apple", "green apple", "red apple", "chicken egg", "chicken eggs", "chicken's egg", "milk", "jug of milk", "milk jug", "honeycomb", "honey comb", "sack of flour", "gourd", "gourds"]);
  if (farmNames.has(name) || matchesWords(text, ["farm produce"])) return "farm-produce";
  const huntingNames = new Set(["venison", "raw beef", "raw meat", "bear claws", "hagraven claw", "bone hawk claw", "sabre cat tooth", "eye of sabre cat", "boar tusk"]);
  if (huntingNames.has(name) || (recordType !== "armor" && matchesWords(text, ["pelt", "hide", "mammoth snout", "mammoth tusk", "antler", "bear tooth", "wolf tooth", "animal part", "hunting loot"]))) return "hunting-loot";
  if (matchesWords(text, ["soul gem", "garnet", "amethyst", "emerald", "ruby", "sapphire", "diamond", "ancient nord", "draugr", "dwemer scrap", "dwarven scrap", "dragon claw", "golden claw", "iron claw", "ivory claw", "coral claw", "glass claw", "ebony claw", "dungeon loot"])) return "dungeon-loot";
  if (recordType === "ingredient" || matchesWords(text, ["flower", "mushroom", "mora tapinella", "nirnroot", "thistle", "lavender", "jazbay", "juniper", "creep cluster", "imp stool", "nightshade", "cotton", "foraging loot"])) return "foraging-loot";
  return null;
}

function matchesWords(text: string, values: string[]) {
  return values.some((value) => new RegExp(`(?:^|[^a-z])${escapeRegExp(value)}(?:$|[^a-z])`, "i").test(text));
}

function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
