# SkyStore Catalog Builder

An offline, one-way catalog compiler for the **exact Keizaal Skyrim data folder and load order**. It uses Mutagen to parse plugins and walks the load order from lowest to highest, so a later record replaces an earlier record with the same local Form ID.

The web application never receives Bethesda game files, NIF models, BSA archives, or textures. The output is normalized JSON whose artwork fallbacks reference the supplied original category PNGs.

## Build

```powershell
dotnet build .\tools\SkyStore.CatalogBuilder\SkyStore.CatalogBuilder.csproj
```

## Generate a catalog

Pass the exact `plugins.txt` (or another ordered file containing `.esm`, `.esp`, and `.esl` names) that Keizaal uses, and the corresponding `Data` directory.

```powershell
dotnet run --project .\tools\SkyStore.CatalogBuilder -- `
  --data "D:\Keizaal\Data" `
  --load-order "D:\Keizaal\plugins.txt" `
  --output ".\output\keizaal-catalog" `
  --release ae `
  --artwork-manifest ".\tools\SkyStore.CatalogBuilder\examples\artwork-manifest.json"
```

`--release` accepts `se` (the default) or `ae`. An artwork manifest is optional: it is a JSON object mapping a `plugin:localFormId` key to an already-produced web image path. It lets a separate Blender/PyNifly rendering pass mark item artwork as `rendered` without coupling that toolchain to SkyStore's runtime.

The generated directory contains:

- `skystore-catalog-current.json` — the currently built normalized bundle.
- `skystore-catalog-<version>.json` — immutable versioned copy.
- `skystore-catalog-report.json` — item/category counts and the unresolved-artwork count.
- `fallbackIcon` values reference the supplied `catalog-icons` PNG set: `food`, `armor`, `weapon`, `book`, `potion`, `misc`, `ore`, `flower`, and `ingot`. Every catalog item has a fallback when no item-specific UESP image is matched.

The bundle also includes `recipes`, resolved from winning Skyrim `ConstructibleObject` records. A recipe has its output, ingredient quantities, yield, workbench, condition provenance, and explicit unresolved mappings. Profession, mastery, and labor fields remain null unless the installed Keizaal data authoritatively supplies them. See [the Keizaal recipe evidence](docs/keizaal-recipe-evidence.md).

Place the supplied `catalog-icons` PNG set and any rendered WebP images in SkyStore's public catalog-asset volume before activating the catalog version. The builder does not generate or overwrite icon artwork; the JSON only references web paths, and no source game asset is redistributed.

## What is imported

The reader considers winning overrides for inventory-capable weapon, armor/clothing, jewelry, ammunition, ingredient, ingestible (food, drink, potion, poison), book, spell-tome, scroll, soul-gem, misc, key, and light-style records. It emits a stable UUID based on the original FormKey plugin and local Form ID (so overrides cannot collide), while recording the effective winning plugin separately in metadata. It also includes a display name/editor ID, category/aliases, value/weight, common combat/equipment/effect metadata when present, model path, and artwork status.

Commerce categories are curated deterministically from record type and conservative naming rules. Alchemy ingredients use `flower.png`; food, potions, weapons, armor, and books use their corresponding icon. Within the combined `Ores & ingots` category, the fallback inspects the item name and editor ID so ingots use `ingot.png` and other records use `ore.png`. A store manager can later map custom items or refine categories through SkyStore's catalog workflow; historical catalog items are never deleted by this builder.

## Validation and reproducibility

```powershell
dotnet run --project .\tools\SkyStore.CatalogBuilder -- --validate --output ".\output\keizaal-catalog"
```

Validation checks schema version, unique stable IDs, names, categories, and that every item has a fallback artwork path. The load-order checksum determines the catalog version and ordering is deterministic. For byte-for-byte reproducible artifacts, set `SOURCE_DATE_EPOCH` before building; otherwise `generatedAt` records the build time.

The builder deliberately fails when a listed plugin is not present under `--data`, rather than silently producing a partial economy catalog.
