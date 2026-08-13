# Keizaal recipe evidence (installed build inspected 2026-08-12)

SkyStore's recipe bundle is based on the effective `ConstructibleObject` (COBJ) records in the installed Keizaal load order. The web application never reads game files.

## Confirmed custom recipe data

- The current build emits 12,732 inventory items and 3,014 raw crafting records.
- Keizaal potion recipes use the dedicated alchemy workbench and explicit Alchemist gates. For example, Minor Healing is 7 Wheat + 15 Blue Mountain Flowers; Healing adds 8 Imp Stool and reduces flowers to 10; Plentiful Healing also adds 2 Eye of Sabre Cat.
- `Alchemist00`, `Alchemist20`, `Alchemist40`, and `Alchemist60` map to Novice, Advanced, Expert, and Master.
- Keizaal records also define `KzlAlchemy*`, `KzlCooking*`, `KzlMining*`, `KzlSmithing*`, `KzlTailor*`, and `KzlWoodcutter*` mastery gates. `Tailor` is presented as Tailoring and `Woodcutter` as Woodworking.
- Tailoring recipes include the installed clothing plugins and Keizaal overrides. Confirmed examples include Common Clothes (1 Tundra Cotton + 1 Leather, Advanced) and Fine Clothes Wolfsbane (16 Thread + 2 Leather + 2 Gold + 2 Silver, Master).
- Additional gates are retained separately from mastery. Confirmed examples include Expert Alchemy elixirs requiring `Special Elixir Recipes`, College robes requiring both their Tailoring level and `College Recipe Book`, and faction clothing accepting one of multiple recipe books.
- Skyrim condition `OR` flags are carried into the normalized bundle as alternative groups. This prevents alternatives such as Cultist or Priests recipe books from being displayed as if both were required.
- Ingredient counts come directly from Mutagen's typed container entry. Zero/omitted game counts normalize to one; non-unit counts are never replaced with one.
- Forge COBJ records retain exact output and ingredient quantities even when they have no Keizaal profession condition. SkyPatcher's `constructibleObject` rules provide a second independent signal by redirecting matching Sentinel and equipment recipes to `CraftingSmithingForge`.
- A forge recipe whose output is a weapon, armor item, or ammunition is therefore classified as Smithing when no explicit profession gate already owns it. The current build recovers 637 Smithing recipes: 197 Novice, 123 Advanced, 171 Expert, and 146 Master.
- Smithing mastery is inferred first from the recipe's own Steel, Orcish, Elven, Dwarven, Advanced Armors, Glass, Ebony, Daedric, or Dragon smithing requirement. SkyPatcher material families are the fallback; otherwise the forge recipe is Novice. The normalized recipe source list records which classification rule was used.
- Recipes assigned to Tailoring by explicit Keizaal gates or the established clothing-record pattern are never reassigned to Smithing merely because they use the forge workbench.
- Cooking-pot recipes are classified as Cooking only when no explicit profession gate already applies. This recovers 12 additional food recipes while retaining Keizaal's Advanced, Expert, and Master Cooking gates where present.

## Runtime boundary

The inspected multiplayer client sends a generic craft command containing a workbench, inputs, and result. The native client also contains `PROFESSION_INFO`, `professionItems`, and `professionOIDs` fields. This is evidence that some profession eligibility, including injected world-object lists such as ore veins, is delivered by the server at runtime. That live payload is not part of the offline load order and is not fabricated by the extractor.

SkyPatcher workbench overrides and classification decisions are preserved as provenance. Crafting-category JSON and inventory-injector metadata affect UI grouping/icons, not material quantities or mastery. Records without a recognized profession gate or strong workbench/output pattern remain in the raw bundle for auditability.

Keizaal defines `KzlMiningNovice`, `KzlMiningAdvanced`, `KzlMiningExpert`, and `KzlMiningMaster`, but the installed plugins do not attach those gates to offline ore recipes. SkyStore's Mining page therefore links real load-order items while marking the proficiency grouping as inferred from the Mining gates, Smithing material progression, and the supplied store ledger. The server-provided profession object list remains the authority if it is captured in a future extractor run.

Labor fees remain zero unless an explicit SkyStore recipe supplies one; the installed game records do not define RP labor fees.
