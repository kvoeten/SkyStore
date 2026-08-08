# Keizaal recipe evidence (installed build inspected 2026-08-08)

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

## Runtime boundary

The inspected multiplayer client sends a generic craft command containing a workbench, inputs, and result. No second static recipe list was found in the client. The server may still validate entitlement at runtime, but the installed plugins are the authoritative offline source currently available for recipe materials and profession gates.

SkyPatcher workbench overrides are preserved as provenance. Crafting-category JSON and inventory-injector metadata affect UI grouping/icons, not material quantities or mastery. Records without a recognized Keizaal profession gate or confirmed Keizaal recipe/workbench pattern remain in the raw bundle for auditability but are not assigned a speculative profession tier. The installed build contains no recipe using the `Alchemist60` Master gate; SkyStore leaves that tier empty rather than inventing a mapping that may only exist server-side.

Labor fees remain zero unless an explicit SkyStore recipe supplies one; the installed game records do not define RP labor fees.
