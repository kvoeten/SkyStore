# Catalog image policy

SkyStore keeps its flat category artwork in the application image and item-specific transparent PNG renders in the catalog image volume. The running web service never reads a game installation, BSA archive, NIF, DDS texture, wiki, or mod host.

## Display rules

- Dense search, price, stock, and profession lists use the restrained flat category icons for visual consistency.
- Item detail pages prefer a local NIF render when the active catalog supplies one.
- Every item always retains a category fallback, so missing or failed renders cannot create broken artwork.
- Item renders are immutable UUID-and-catalog-version-named PNGs and are served only through `/item-renders/<item UUID>-<catalog version>.png`.

## Render scope

The offline renderer selects only:

1. Outputs of recipes assigned to a Keizaal profession.
2. Inventory items consumed by those recipes.
3. Condition-linked requirements that resolve to catalog inventory items, such as recipe books.

Perks, quests, races, and profession gates remain structured recipe requirements but are not treated as physical render targets. Unrelated catalog objects use their category artwork.

## Offline pipeline

`SkyStore.ItemRenderer` reads the normalized catalog, active `plugins.txt`, and exact Skyrim `Data` directory. Loose files override archived files; later load-order archives override earlier ones. It extracts only each selected ground/world NIF and the DDS paths referenced by that model into an ignored work directory. Blender and a separately installed PyNifly add-on import the NIF, frame the visible mesh consistently, and save a 512×512 transparent PNG.

PyNifly remains an optional external GPL-3.0 operator tool. SkyStore does not vendor, link, download at runtime, or redistribute it. Skyrim and Keizaal source assets never enter the repository or production container; only the normalized catalog and final PNG renders are packaged.

## Activation

The renderer emits an artwork manifest mapping stable catalog keys to local `/item-renders/` URLs. The catalog builder records those URLs as rendered artwork. Catalog activation transactionally replaces prior item-specific render rows while retaining stable category fallbacks and historical item identities.

Release automation verifies the catalog version, render manifest, report, image count, and checksums before placing the PNGs under `/var/lib/skystore/catalog-images/renders` in the release image.
