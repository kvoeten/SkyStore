# Keizaal recipe evidence (installed build inspected 2026-08-05)

SkyStore's recipe bundle is based on the actual winning `ConstructibleObject` (COBJ) records in the supplied Keizaal load order, rather than on a guessed profession price list.

## Recoverable recipe data

- The full installed load order resolves **2,982** winning COBJ records.
- Each emitted recipe preserves its COBJ identity, output FormLink, output count, ingredient FormLinks/counts, workbench FormLink, editor ID, and source plugin.
- FormLinks are mapped only when they point to a catalog inventory item. Missing outputs or ingredients are emitted in `unresolvedMappings`; they are not substituted with a similarly named item.
- The inspected build yielded **2,832** recipes with no unresolved mapping. The remaining 150 have explicit unresolved mappings: 55 outputs are not inventory-capable catalog records, 73 building/layout records contain no material entries, and 34 have conflicting runtime workbench overrides.

## Non-standard Keizaal files examined

| Location | Evidence | Recipe interpretation |
|---|---|---|
| `Data/SKSE/Plugins/SkyPatcher/constructibleObject/` | 37 INI files, 49 `filterByEditorIdContains=…:workbenchKeyword=…` rules. Example: `a. Fur1/Sentinel.esp.ini` changes `RecipeArmorTH_Fur1` to `Skyrim.esm|00088105`. | These alter an existing COBJ's workbench availability; they do not declare an output, materials, output yield, profession tier, labor, or fee. The builder applies a single unambiguous matching rule (262 recipes in this build) and preserves its file as a recipe source. Conflicting rules are emitted as unresolved mappings; no arbitrary rule order is assumed. |
| `Data/SKSE/Plugins/CraftingCategories/*.json` | 11 JSON files; `Sentinel.json` declares UI sections/keyword categories such as weapons and armor. | UI categorization only, not recipe material or profession data. |
| `Data/SKSE/Plugins/InventoryInjector/MoreCraftableEquipment.json` | One JSON file assigns UI icons/subtypes to form IDs. | Icon metadata only, not a recipe definition. |
| `Data/Platform/` and `Data/NirnLabUIPlatform/` readable configuration/source | No human-readable profession/mastery/labor recipe specification was found. The shipped multiplayer client bundle is opaque and is not treated as an authoritative recipe source. | No profession/mastery/fee is inferred. |

## Deliberate nulls

Skyrim COBJ conditions can encode game perk gates, but this installed Keizaal build contains no separately authored mapping from those conditions to the RP server's professions or mastery labels. Therefore bundle fields `profession`, `masteryTier`, and `laborFee` are `null`. SkyStore must not equate vanilla perk names with RP mastery tiers without an authoritative server-side mapping.

When Keizaal publishes a profession mapping or a custom recipe data file, add an explicit importer with source provenance rather than changing these nulls by heuristic.
