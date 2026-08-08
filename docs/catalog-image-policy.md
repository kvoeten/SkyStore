# Catalog image policy

SkyStore keeps generated category artwork in the application image and the larger item-specific UESP pack in its persistent `catalog_images` volume. The running web service never hotlinks a wiki, mod host, or game installation.

## Item-specific images

Item-specific images are downloaded as bounded 512-pixel derivatives from the recursive `Category:Skyrim-Icons` tree on UESP. Their manifest retains the UESP file page, the downloaded image URL, timestamp, dimensions, local SHA-1, category trail, and local URL. UESP is recorded as the retrieval source, not asserted to be the owner or licensor of Bethesda game imagery.

Automated matching is deliberately conservative: an exact item identity match is preferred, and a matched image may propagate only to records sharing an unambiguous exact model path. Ambiguous images remain unused. Item-specific renders are displayed only while inspecting an item; dense guides and search results always use the consistent flat category set.

## Generated fallbacks

Unmatched items use original SkyStore category artwork supplied for this project. The nine transparent 512-by-512 PNGs are simple, flat, single-object white icons, with black outlines only where needed for legibility:

- `armor.png` — armor, clothing, and jewelry;
- `book.png` — books, scrolls, and spell tomes;
- `food.png` — food and drink;
- `flower.png` — alchemy ingredients;
- `ingot.png` — ingots;
- `misc.png` — crafting materials other than ores/ingots, hides, leather, soul gems, keys, tools, and miscellaneous goods;
- `ore.png` — ores;
- `potion.png` — potions and poisons;
- `weapon.png` — weapons and ammunition.

The offline builder uses the item name and editor ID to select `ore.png` or `ingot.png` for the combined `Ores & ingots` category.

The generation prompts require one isolated object, a flat white fill, and at most a black outline. They prohibit color, shading, texture, text, faction marks, dragon marks, Bethesda artwork, Skyrim artwork, and SkyUI artwork.

## Activation

Catalog image activation is manifest-driven and transactional. Every active catalog item receives exactly one current UESP or SkyStore-category mapping. The importer replaces prior UESP/category mappings but leaves historical catalog records intact.

The setup-only `catalog-image-sync` service copies the offline pack into the persistent volume before the mapping importer runs. The web service mounts that volume read-only and serves only supported, flat image filenames through `/uesp-icons/*`. The image archive is deliberately excluded from the Docker build context so rebuilding application code does not repeatedly transfer or layer hundreds of megabytes of static data.
