import { pathToFileURL } from "node:url";
import { and, eq, like } from "drizzle-orm";
import { createDatabase } from "./index";
import { agreementAcceptances, auditEvents, catalogItems, jobs, memberships, officialPriceRules, stores, users } from "./schema";

export const WHITERUN_STORE_ID = "00000000-0000-4000-8000-000000000002";

export const SEED_CATALOG_ITEMS = [
  ["iron-ore", "Iron Ore", "MISC", "ore", 2, "Skyrim.esm", "00071CF3"],
  ["corundum-ore", "Corundum Ore", "MISC", "ore", 40, "Skyrim.esm", "0005ACDB"],
  ["wheat", "Wheat", "INGR", "ingredient", 1, "Skyrim.esm", "0004B0BA"],
  ["blue-mountain-flower", "Blue Mountain Flower", "FLOR", "ingredient", 2, "Skyrim.esm", "00077E1C"],
  ["leather", "Leather", "MISC", "crafting_material", 10, "Skyrim.esm", "000DB5D2"],
  ["healing-potion", "Potion of Healing", "ALCH", "potion", 67, "Skyrim.esm", "0003EADE"],
  ["stamina-potion", "Potion of Stamina", "ALCH", "potion", 67, "Skyrim.esm", "00039BE8"],
  ["magicka-potion", "Potion of Magicka", "ALCH", "potion", 67, "Skyrim.esm", "0003EAE1"],
  ["other-potion", "Potion of Resist Fire", "ALCH", "potion", 57, "Skyrim.esm", "00039B4A"],
  ["raw-rabbit-leg", "Raw Rabbit Leg", "ALCH", "food", 3, "Skyrim.esm", "00065C9E"],
  ["venison", "Venison", "ALCH", "food", 2, "Skyrim.esm", "000669A2"],
  ["raw-beef", "Raw Beef", "ALCH", "food", 3, "Skyrim.esm", "00065C99"],
  ["refined-moonstone", "Refined Moonstone", "MISC", "ingot", 75, "Skyrim.esm", "0005AD9F"],
  ["leather-bracers", "Leather Bracers", "ARMO", "clothing", 25, "Skyrim.esm", "00013921"],
  ["fine-clothes", "Fine Clothes", "ARMO", "clothing", 100, "Skyrim.esm", "00086991"],
  ["wolf-pelt", "Wolf Pelt", "MISC", "hide", 10, "Skyrim.esm", "0003AD74"],
  ["sabre-cat-pelt", "Sabre Cat Pelt", "MISC", "hide", 40, "Skyrim.esm", "0003AD6D"],
  ["bear-pelt", "Bear Pelt", "MISC", "hide", 50, "Skyrim.esm", "0003AD52"],
  ["ancient-nord-sword", "Ancient Nord Sword", "WEAP", "weapon", 13, "Skyrim.esm", "0002C66F"],
  ["garnet", "Garnet", "MISC", "gem", 100, "Skyrim.esm", "00063B45"],
  ["amethyst", "Amethyst", "MISC", "gem", 120, "Skyrim.esm", "00063B46"],
  ["petty-soul-gem", "Petty Soul Gem", "MISC", "soul_gem", 10, "Skyrim.esm", "0002E4E2"],
  ["common-soul-gem", "Common Soul Gem", "MISC", "soul_gem", 50, "Skyrim.esm", "0002E4E6"],
  ["silver-necklace", "Silver Necklace", "ARMO", "jewelry", 100, "Skyrim.esm", "0009171B"],
  ["moon-sugar", "Moon Sugar", "INGR", "ingredient", 50, "Skyrim.esm", "000D8E3F"],
  ["lockpick", "Lockpick", "MISC", "lockpick", 10, "Skyrim.esm", "0000000A"],
  ["spell-tome-fireball", "Spell Tome: Fireball", "BOOK", "spell_tome", 318, "Skyrim.esm", "000A2706"],
  ["quicksilver-ore", "Quicksilver Ore", "MISC", "ore", 25, "Skyrim.esm", "0005ACE2"],
  ["orichalcum-ore", "Orichalcum Ore", "MISC", "ore", 30, "Skyrim.esm", "0005ACDD"],
  ["gold-ore", "Gold Ore", "MISC", "ore", 50, "Skyrim.esm", "0005ACDE"],
  ["silver-ore", "Silver Ore", "MISC", "ore", 25, "Skyrim.esm", "0005ACDF"],
  ["skooma", "Skooma", "ALCH", "potion", 25, "Skyrim.esm", "00057A7A"]
] as const;

/**
 * Transcription of the opening written sheet. Each price applies to the whole stated bundle:
 * `10 for 1` is 10 units costing 1 septim, not a unit price of 10. Bare rates and `sell`
 * entries are customer-pays; only explicit `buy` entries are store-pays. This is reference
 * policy, not market evidence or a fabricated receipt. Quantity ranges preserve `3-4 for 1`.
 */
export const SEED_OFFICIAL_RATES = [
  { stableKey: "iron-ore", side: "store_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 10, maximumQuantity: 10, notation: "buy: 10 for 1" },
  { stableKey: "iron-ore", side: "customer_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 3, maximumQuantity: 4, notation: "sell: 3-4 for 1" },
  { stableKey: "corundum-ore", side: "store_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 10, maximumQuantity: 10, notation: "buy: 10 for 1" },
  { stableKey: "corundum-ore", side: "customer_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 3, maximumQuantity: 4, notation: "3-4 for 1" },
  { stableKey: "wheat", side: "store_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 2, maximumQuantity: 2, notation: "buy: 2 for 1" },
  { stableKey: "wheat", side: "customer_pays", minimumSeptims: 3, maximumSeptims: 3, quantity: 2, maximumQuantity: 2, notation: "2 for 3" },
  { stableKey: "leather", side: "store_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 2, maximumQuantity: 2, notation: "buy: 2 for 1" },
  { stableKey: "leather", side: "customer_pays", minimumSeptims: 2, maximumSeptims: 2, quantity: 1, maximumQuantity: 1, notation: "2" },
  { stableKey: "healing-potion", side: "store_pays", minimumSeptims: 8, maximumSeptims: 8, quantity: 1, maximumQuantity: 1, notation: "buy: 8" },
  { stableKey: "stamina-potion", side: "store_pays", minimumSeptims: 8, maximumSeptims: 8, quantity: 1, maximumQuantity: 1, notation: "buy: 8" },
  { stableKey: "magicka-potion", side: "store_pays", minimumSeptims: 8, maximumSeptims: 8, quantity: 1, maximumQuantity: 1, notation: "buy: 8" },
  { stableKey: "other-potion", side: "store_pays", minimumSeptims: 5, maximumSeptims: 5, quantity: 1, maximumQuantity: 1, notation: "buy: 5" },
  { stableKey: "blue-mountain-flower", side: "store_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 10, maximumQuantity: 10, notation: "buy: 10 for 1" },
  { stableKey: "raw-rabbit-leg", side: "store_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 4, maximumQuantity: 4, notation: "buy: 4 for 1" },
  { stableKey: "venison", side: "store_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 2, maximumQuantity: 2, notation: "buy: 2 for 1" },
  { stableKey: "raw-beef", side: "store_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 2, maximumQuantity: 2, notation: "buy: 2 for 1" },
  { stableKey: "wolf-pelt", side: "customer_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 1, maximumQuantity: 1, notation: "1 (wolf mapped to Wolf Pelt)" },
  { stableKey: "sabre-cat-pelt", side: "customer_pays", minimumSeptims: 4, maximumSeptims: 4, quantity: 1, maximumQuantity: 1, notation: "4 (saber cat mapped to Sabre Cat Pelt)" },
  { stableKey: "bear-pelt", side: "customer_pays", minimumSeptims: 8, maximumSeptims: 8, quantity: 1, maximumQuantity: 1, notation: "8 (bear mapped to Bear Pelt)" },
  { stableKey: "ancient-nord-sword", side: "customer_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 1, maximumQuantity: 1, notation: "1" },
  { stableKey: "garnet", side: "customer_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 1, maximumQuantity: 1, notation: "1" },
  { stableKey: "amethyst", side: "customer_pays", minimumSeptims: 2, maximumSeptims: 2, quantity: 1, maximumQuantity: 1, notation: "2 (other gem)" },
  { stableKey: "petty-soul-gem", side: "customer_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 1, maximumQuantity: 1, notation: "1" },
  { stableKey: "common-soul-gem", side: "customer_pays", minimumSeptims: 2, maximumSeptims: 2, quantity: 1, maximumQuantity: 1, notation: "2 (other soul gem)" },
  { stableKey: "silver-necklace", side: "customer_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 1, maximumQuantity: 1, notation: "1 (jewelry)" },
  { stableKey: "moon-sugar", side: "customer_pays", minimumSeptims: 10, maximumSeptims: 10, quantity: 1, maximumQuantity: 1, notation: "10" },
  { stableKey: "lockpick", side: "customer_pays", minimumSeptims: 5, maximumSeptims: 5, quantity: 1, maximumQuantity: 1, notation: "5" },
  { stableKey: "spell-tome-fireball", side: "customer_pays", minimumSeptims: 20, maximumSeptims: 20, quantity: 1, maximumQuantity: 1, notation: "20" },
  { stableKey: "refined-moonstone", side: "customer_pays", minimumSeptims: 70, maximumSeptims: 70, quantity: 1, maximumQuantity: 1, notation: "70" },
  { stableKey: "quicksilver-ore", side: "customer_pays", minimumSeptims: 40, maximumSeptims: 40, quantity: 1, maximumQuantity: 1, notation: "40" },
  { stableKey: "orichalcum-ore", side: "customer_pays", minimumSeptims: 30, maximumSeptims: 30, quantity: 1, maximumQuantity: 1, notation: "30" },
  { stableKey: "gold-ore", side: "customer_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 1, maximumQuantity: 1, notation: "1 (gold)" },
  { stableKey: "silver-ore", side: "customer_pays", minimumSeptims: 1, maximumSeptims: 1, quantity: 1, maximumQuantity: 1, notation: "1 (silver)" },
  { stableKey: "skooma", side: "customer_pays", minimumSeptims: 50, maximumSeptims: 50, quantity: 1, maximumQuantity: 1, notation: "50" }
] as const satisfies readonly { stableKey: string; side: "store_pays" | "customer_pays"; minimumSeptims: number; maximumSeptims: number; quantity: number; maximumQuantity: number; notation: string }[];

/** Installs published reference rules without inventing a user identity or market evidence. */
export async function installOpeningReferences() {
  const { db, client } = createDatabase();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(stores).values({ id: WHITERUN_STORE_ID, slug: "whiterun-general-store", name: "Whiterun General Store", ownerId: null, active: false, targetMarkupBps: 2500 }).onConflictDoNothing();
      const activeItems = await tx.select({ id: catalogItems.id, plugin: catalogItems.plugin, localFormId: catalogItems.localFormId }).from(catalogItems).where(eq(catalogItems.status, "active"));
      const byForm = new Map(activeItems.map((item) => [`${item.plugin?.toLowerCase()}:${item.localFormId?.toUpperCase()}`, item.id]));
      const itemIdByRuleKey = new Map(SEED_CATALOG_ITEMS.map(([ruleKey, , , , , plugin, localFormId]) => [ruleKey, byForm.get(`${plugin.toLowerCase()}:${localFormId.toUpperCase()}`)]));
      const unresolved: string[] = [];
      const rates = SEED_OFFICIAL_RATES.flatMap(({ stableKey, side, minimumSeptims, maximumSeptims, quantity, maximumQuantity, notation }) => {
        const itemId = itemIdByRuleKey.get(stableKey);
        if (!itemId) { unresolved.push(stableKey); return []; }
        return [{ storeId: WHITERUN_STORE_ID, itemId, side, minimumSeptims, maximumSeptims, quantity, maximumQuantity, effectiveFrom: new Date("2026-08-05T00:00:00Z"), sourceLabel: `Whiterun General Store written rates (2026-08-05): ${notation}`, createdBy: null }];
      });
      await tx.delete(officialPriceRules).where(and(eq(officialPriceRules.storeId, WHITERUN_STORE_ID), like(officialPriceRules.sourceLabel, "Whiterun General Store written rates (2026-08-05):%")));
      if (rates.length) await tx.insert(officialPriceRules).values(rates).onConflictDoNothing();
      if (unresolved.length) await tx.insert(auditEvents).values({ actorId: null, storeId: WHITERUN_STORE_ID, action: "official_prices.mapping_required", entityType: "official_price_import", after: { unresolved: [...new Set(unresolved)] } });
      await tx.insert(jobs).values({ kind: "market.public_snapshot", payload: { reason: "opening_references_imported" } });
    });
  } finally { await client.end(); }
}

export async function bootstrapAdminStore(userId: string) {
  await installOpeningReferences();
  const { db, client } = createDatabase();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(stores).values({ id: WHITERUN_STORE_ID, slug: "whiterun-general-store", name: "Whiterun General Store", ownerId: userId, active: true, targetMarkupBps: 2500 }).onConflictDoUpdate({ target: stores.slug, set: { ownerId: userId, active: true } });
      await tx.insert(memberships).values({ storeId: WHITERUN_STORE_ID, userId, role: "owner", trust: "verified" }).onConflictDoUpdate({ target: [memberships.storeId, memberships.userId], set: { role: "owner", trust: "verified", revokedAt: null } });
      await tx.insert(agreementAcceptances).values({ storeId: WHITERUN_STORE_ID, userId, agreementVersion: "alliance-v1" }).onConflictDoNothing();
      await tx.insert(jobs).values({ kind: "market.public_snapshot", payload: { reason: "administrator_bootstrap" } });
    });
  } finally { await client.end(); }
}

export async function seedDatabase() {
  const discordId = process.env.SKYSTORE_ADMIN_DISCORD_ID;
  if (!discordId) throw new Error("SKYSTORE_ADMIN_DISCORD_ID is required.");
  const { db, client } = createDatabase();
  try {
    const [admin] = await db.select({ id: users.id }).from(users).where(and(eq(users.discordId, discordId), eq(users.globalRole, "platform_admin"))).limit(1);
    if (!admin) throw new Error("The configured administrator must sign in with Discord before bootstrapping the Whiterun store.");
    await bootstrapAdminStore(admin.id);
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDatabase().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
