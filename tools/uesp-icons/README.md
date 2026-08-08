# Offline catalog icon pack

SkyStore serves only locally extracted images. No runtime route fetches UESP or a game installation.

`npm run catalog:icons:uesp:ingest -- --dry-run --limit 3` performs a small metadata-only smoke test. The production crawl intentionally needs an explicit full run:

```powershell
npm run catalog:icons:uesp:ingest -- --concurrency 3
```

The downloader uses the MediaWiki API with a polite SkyStore User-Agent, one API request per second, recursive category discovery, bounded 512-pixel image transfers, retries, Range resumption, local SHA-1 verification, and `catalog/generated/uesp-icons/uesp-icons-manifest.json` provenance. Original-size files are checked against MediaWiki's SHA-1; resized derivatives receive a computed local SHA-1 that is checked on every resume. The manifest describes the UESP source of a capture; it does not assert ownership of the UESP image.

Build the local SkyStore category-art fallback manifest before mapping:

```powershell
npm run catalog:icons:fallbacks:build
```

This hashes the nine original generated SkyStore category images in `catalog/generated/catalog-icons/` and writes `skystore-category-fallback-manifest.json` alongside them. The list/fallback categories are Food, Armor, Weapons, Books, Potions, Misc, Ore, Flowers, and Ingots. Every active catalog item maps to one of these calm flat icons; ore and ingot selection also considers the item name and Editor ID.

After a complete UESP crawl, generate and install the local mapping:

```powershell
npm run catalog:icons:uesp:map
docker compose --profile setup run --rm catalog-image-sync
docker compose --profile setup run --rm uesp-icon-import
```

Run the image sync before the database importer. It copies the local offline files into SkyStore's persistent `catalog_images` Docker volume; the app image itself remains small and the web container mounts this data read-only.

The map prioritizes exact UESP name/editor/Form ID matches. A downloaded UESP icon may propagate only across the same normalized NIF model path when a unique exact normalized name-and-category seed establishes it. Every remaining item uses a category-compatible original SkyStore generated image. Dense guides use the flat category icon regardless of exact-match availability; item-specific UESP renders appear only on item detail pages. The mapping manifest retains source URL, original URL, SHA-1, dimensions, MIME type, timestamp, category trail, local path, and provider for every item.
