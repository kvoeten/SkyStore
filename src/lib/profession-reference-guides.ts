export type SmithingTier = "Novice" | "Advanced" | "Expert" | "Master";
export type SmithingReferenceItem = { name: string; catalogName: string; price: number; priceQuantity: number };
export type SmithingReferenceQuality = { quality: string; tier: SmithingTier; items: SmithingReferenceItem[] };
export type SmithingArmorSlot = "Head" | "Body" | "Hands" | "Feet";
export type SmithingArmorSet = {
  name: string;
  tier: SmithingTier;
  components: Array<{ slot: SmithingArmorSlot; catalogName: string; price: number }>;
  totalPrice: number;
};
export type MiningReferenceResource = { name: string; catalogName: string; price: number; evidence: string };
export type MiningReferenceTier = { tier: SmithingTier; resources: MiningReferenceResource[] };

const SPECIAL_CATALOG_NAMES: Record<string, string> = {
  "Iron:Long bow": "Long Bow",
  "Iron:Chest armor": "Iron Armor",
  "Iron:Banded armor": "Banded Iron Armor",
  "Iron:Banded shield": "Banded Iron Shield",
  "Common:Chest armor": "Common Aketon",
  "Common:Banded armor": "Common Brigandine",
  "Common:Helmet": "Common Hood",
  "Common:Hide gauntlets": "Hide Bracers",
  "Common:Hide boots": "Hide Boots",
  "Common:Hide helmet": "Hide Helmet",
  "Common:Hide armor": "Hide Armor",
  "Common:Studded armor": "Studded Armor",
  "Common:Leather shield": "Rugged Leather Shield",
  "Steel:Hunting bow": "Hunting Bow",
  "Steel:Gauntlets": "Steel Nordic Gauntlets",
  "Steel:Boots": "Steel Cuffed Boots",
  "Steel:Chest armor": "Steel Armor",
  "Orcish:Chest armor": "Orcish Armor",
  "Orcish:Hide gauntlets": "Orcish Hide Gauntlets",
  "Orcish:Hide boots": "Orcish Hide Boots",
  "Orcish:Hide helmet": "Orcish Hide Helmet",
  "Orcish:Hide armor": "Orcish Hide Armor",
  "Orcish:Studded armor": "Orcish Studded Armor",
  "Elven:Chest armor": "Elven Armor",
  "Elven:Guild chest armor": "Elven Gilded Armor",
  "Elven:Bosmer gauntlets": "Bosmer Gloves",
  "Elven:Bosmer boots": "Bosmer Boots",
  "Elven:Bosmer hood": "Bosmer Hood",
  "Elven:Bosmer armor": "Bosmer Armor",
  "Elven:Plate gauntlets": "Bosmer Plate Gauntlets",
  "Elven:Plate boots": "Bosmer Plate Boots",
  "Elven:Plate hood": "Bosmer Plate Helmet",
  "Elven:Plate armor": "Bosmer Plate Armor",
  "Dwarven:Chest armor": "Dwarven Armor",
  "Glass:Chest armor": "Glass Armor",
  "Glass:Wild gauntlets": "Wild Hunt Gloves",
  "Glass:Wild boots": "Wild Hunt Boots",
  "Glass:Wild helmet": "Wild Hunt Helmet",
  "Glass:Wild chest armor": "Wild Hunt Armor",
  "Ebony:Chest armor": "Ebony Armor",
  "Ebony:Gilded dagger": "Gilded Ebony Dagger",
  "Ebony:Gilded sword": "Gilded Ebony Sword",
  "Ebony:Gilded mace": "Gilded Ebony Mace",
  "Ebony:Gilded war axe": "Gilded Ebony War Axe",
  "Ebony:Gilded battleaxe": "Gilded Ebony Battleaxe",
  "Ebony:Gilded warhammer": "Gilded Ebony Warhammer",
  "Ebony:Gilded greatsword": "Gilded Ebony Greatsword",
  "Ebony:Gilded gauntlets": "Gilded Ebony Gauntlets",
  "Ebony:Gilded boots": "Gilded Ebony Boots",
  "Ebony:Gilded helmet": "Gilded Ebony Helmet",
  "Ebony:Gilded chest armor": "Gilded Ebony Armor",
  "Ebony:Gilded shield": "Gilded Ebony Shield",
};

const ITEM_TITLE: Record<string, string> = {
  "Arrow bundle": "Arrow",
  Dagger: "Dagger",
  Sword: "Sword",
  Mace: "Mace",
  "War axe": "War Axe",
  Battleaxe: "Battleaxe",
  Warhammer: "Warhammer",
  Greatsword: "Greatsword",
  Gauntlets: "Gauntlets",
  Boots: "Boots",
  Helmet: "Helmet",
  Shield: "Shield",
  "Common bow": "Bow",
  "Orcish bow": "Bow",
  "Elven bow": "Bow",
  "Dwarven bow": "Bow",
  "Glass bow": "Bow",
  "Ebony bow": "Bow",
};

export const SMITHING_REFERENCE_QUALITIES: SmithingReferenceQuality[] = [
  quality("Iron", "Novice", "Arrow bundle:6|Dagger:7|Sword:12|War axe:13|Mace:19|Long bow:8|Warhammer:26|Battleaxe:25|Greatsword:25|Gauntlets:13|Boots:19|Helmet:19|Chest armor:31|Banded armor:40|Shield:23|Banded shield:32"),
  quality("Common", "Novice", "Sword:15|War axe:15|Common bow:35|Battleaxe:27|Gauntlets:6|Boots:11|Helmet:11|Chest armor:20|Banded armor:40|Hide gauntlets:6|Hide boots:11|Hide helmet:9|Hide armor:20|Studded armor:26|Leather shield:19"),
  quality("Steel", "Advanced", "Arrow bundle:12|Dagger:18|Sword:29|War axe:40|Mace:41|Hunting bow:32|Battleaxe:53|Warhammer:54|Greatsword:59|Gauntlets:30|Boots:41|Helmet:30|Chest armor:54|Shield:40"),
  quality("Orcish", "Expert", "Arrow bundle:126|Dagger:132|Sword:258|Mace:384|War axe:259|Orcish bow:257|Battleaxe:511|Warhammer:512|Greatsword:516|Gauntlets:259|Boots:385|Helmet:259|Chest armor:512|Hide gauntlets:137|Hide boots:135|Hide helmet:134|Hide armor:143|Studded armor:148|Shield:384"),
  quality("Elven", "Expert", "Arrow bundle:162|Dagger:348|Sword:348|Mace:510|War axe:349|Elven bow:504|Battleaxe:515|Warhammer:516|Greatsword:516|Gauntlets:172|Boots:334|Helmet:333|Chest armor:659|Guild chest armor:839|Bosmer gauntlets:172|Bosmer boots:334|Bosmer hood:333|Bosmer armor:659|Plate gauntlets:179|Plate boots:341|Plate hood:341|Plate armor:666|Shield:655"),
  quality("Dwarven", "Expert", "Arrow bundle:3600|Dagger:3615|Sword:3615|Mace:7215|War axe:3616|Dwarven bow:7205|Battleaxe:7226|Warhammer:7227|Greatsword:7232|Gauntlets:3616|Boots:7216|Helmet:7216|Chest armor:10817|Shield:7215"),
  quality("Glass", "Master", "Arrow bundle:14436|Dagger:14599|Sword:14599|Mace:29035|War axe:14600|Glass bow:29034|Battleaxe:29198|Warhammer:43635|Greatsword:29199|Gauntlets:14603|Boots:29039|Helmet:29039|Chest armor:58074|Wild gauntlets:14603|Wild boots:29039|Wild helmet:29039|Wild chest armor:58074|Shield:57908"),
  quality("Ebony", "Master", "Arrow bundle:72012|Dagger:72013|Sword:144025|Mace:216037|War axe:144026|Ebony bow:216036|Battleaxe:360062|Warhammer:360063|Greatsword:360063|Gilded dagger:72014|Gilded sword:144026|Gilded mace:216038|Gilded war axe:144027|Gilded battleaxe:360063|Gilded warhammer:360064|Gilded greatsword:360064|Gauntlets:144026|Boots:216038|Helmet:216038|Chest armor:360063|Shield:288049|Gilded gauntlets:144027|Gilded boots:216039|Gilded helmet:216039|Gilded chest armor:360064|Gilded shield:288050"),
];

const referencePrices = new Map(SMITHING_REFERENCE_QUALITIES.flatMap((group) => group.items.map((item) => [item.catalogName, item.price] as const)));

export const SMITHING_ARMOR_SETS: SmithingArmorSet[] = [
  armorSet("Iron", "Novice", "Iron Helmet", "Iron Armor", "Iron Gauntlets", "Iron Boots"),
  armorSet("Iron Banded", "Novice", "Iron Helmet", "Banded Iron Armor", "Iron Gauntlets", "Iron Boots"),
  armorSet("Common", "Novice", "Common Hood", "Common Aketon", "Common Gauntlets", "Common Boots"),
  armorSet("Common Banded", "Novice", "Common Hood", "Common Brigandine", "Common Gauntlets", "Common Boots"),
  armorSet("Hide", "Novice", "Hide Helmet", "Hide Armor", "Hide Bracers", "Hide Boots"),
  armorSet("Hide Studded", "Novice", "Hide Helmet", "Studded Armor", "Hide Bracers", "Hide Boots"),
  armorSet("Steel", "Advanced", "Steel Helmet", "Steel Armor", "Steel Nordic Gauntlets", "Steel Cuffed Boots"),
  armorSet("Orcish", "Expert", "Orcish Helmet", "Orcish Armor", "Orcish Gauntlets", "Orcish Boots"),
  armorSet("Orcish Hide", "Expert", "Orcish Hide Helmet", "Orcish Hide Armor", "Orcish Hide Gauntlets", "Orcish Hide Boots"),
  armorSet("Orcish Studded", "Expert", "Orcish Hide Helmet", "Orcish Studded Armor", "Orcish Hide Gauntlets", "Orcish Hide Boots"),
  armorSet("Elven", "Expert", "Elven Helmet", "Elven Armor", "Elven Gauntlets", "Elven Boots"),
  armorSet("Gilded Elven", "Expert", "Elven Helmet", "Elven Gilded Armor", "Elven Gauntlets", "Elven Boots"),
  armorSet("Bosmer", "Expert", "Bosmer Hood", "Bosmer Armor", "Bosmer Gloves", "Bosmer Boots"),
  armorSet("Bosmer Plate", "Expert", "Bosmer Plate Helmet", "Bosmer Plate Armor", "Bosmer Plate Gauntlets", "Bosmer Plate Boots"),
  armorSet("Dwarven", "Expert", "Dwarven Helmet", "Dwarven Armor", "Dwarven Gauntlets", "Dwarven Boots"),
  armorSet("Glass", "Master", "Glass Helmet", "Glass Armor", "Glass Gauntlets", "Glass Boots"),
  armorSet("Wild Bosmer", "Master", "Wild Hunt Helmet", "Wild Hunt Armor", "Wild Hunt Gloves", "Wild Hunt Boots"),
  armorSet("Ebony", "Master", "Ebony Helmet", "Ebony Armor", "Ebony Gauntlets", "Ebony Boots"),
  armorSet("Gilded Ebony", "Master", "Gilded Ebony Helmet", "Gilded Ebony Armor", "Gilded Ebony Gauntlets", "Gilded Ebony Boots"),
];

export const MINING_RESOURCE_TIERS: MiningReferenceTier[] = [
  miningTier("Novice", "Iron Ore:0.25|Corundum Ore:0.25|Silver Ore:1|Gold Ore:1"),
  miningTier("Advanced", "Orichalcum Ore:15|Moonstone Ore:20|Quicksilver Ore:20"),
  miningTier("Expert", "Dwarven Metal Ingot:3000"),
  miningTier("Master", "Malachite Ore:2000|Ebony Ore:30000"),
];

export const WARMAIDEN_SOURCE_URL = "https://docs.google.com/spreadsheets/d/1imDMLrwY9YO5ppk-dK8J99dH8SNskpRLzhganWroMzM/edit?gid=821834206#gid=821834206";

function quality(qualityName: string, tier: SmithingTier, source: string): SmithingReferenceQuality {
  return { quality: qualityName, tier, items: simpleItems(source).map((item) => smithingItem(qualityName, item.name, item.price)) };
}

function smithingItem(qualityName: string, sourceName: string, price: number): SmithingReferenceItem {
  const catalogName = SPECIAL_CATALOG_NAMES[`${qualityName}:${sourceName}`] ?? `${qualityName} ${ITEM_TITLE[sourceName] ?? sourceName}`;
  return { name: catalogName, catalogName, price, priceQuantity: sourceName === "Arrow bundle" ? 24 : 1 };
}

function armorSet(name: string, tier: SmithingTier, head: string, body: string, hands: string, feet: string): SmithingArmorSet {
  const components = ([
    ["Head", head], ["Body", body], ["Hands", hands], ["Feet", feet],
  ] as const).map(([slot, catalogName]) => ({ slot, catalogName, price: requiredReferencePrice(catalogName) }));
  return { name, tier, components, totalPrice: components.reduce((sum, component) => sum + component.price, 0) };
}

function miningTier(tier: SmithingTier, source: string): MiningReferenceTier {
  return {
    tier,
    resources: simpleItems(source).map((resource) => ({
      ...resource,
      catalogName: resource.name,
      evidence: resource.name === "Dwarven Metal Ingot"
        ? "The server-provided Mining list is unavailable offline; this is the closest load-order item to the ledger's Dwarven material entry."
        : "Proficiency is inferred from the Keizaal Mining gates and the material progression used by Smithing.",
    })),
  };
}

function requiredReferencePrice(catalogName: string) {
  const price = referencePrices.get(catalogName);
  if (price == null) throw new Error(`Missing smithing reference price for ${catalogName}`);
  return price;
}

function simpleItems(source: string): Array<{ name: string; price: number }> {
  return source.split("|").map((entry) => { const [name, price] = entry.split(":"); return { name, price: Number(price) }; });
}
