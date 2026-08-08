import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { mapCatalogIcons, type UespIconEntry } from "./uesp-icon-map";

const uesp = (title: string, localPath: string, trail: string[] = ["Category:Skyrim weapon icons"]): UespIconEntry => ({
  title, canonicalTitle: title, localPath, categoryTrail: trail, sourcePageUrl: "https://en.uesp.net/wiki/File:Example", originalUrl: "https://images.uesp.net/example.png", sha1: "a".repeat(40), mime: "image/png", width: 64, height: 64, bytes: 100, timestamp: "2026-08-06T00:00:00Z"
});

describe("mapCatalogIcons", () => {
  it("uses an exact UESP name match and propagates only an unambiguous matching model path", () => {
    const icons = [uesp("File:SR-icon-weapon-Iron Sword.png", "/uesp-icons/iron-sword.png")];
    const mappings = mapCatalogIcons([
      { stableKey: "skyrim.esm:1", name: "Iron Sword", category: "Weapons", modelPath: "Meshes/Weapons/Iron/IronSword.nif" },
      { stableKey: "skyrim.esm:2", name: "Iron Sword Tempered", category: "Weapons", modelPath: "meshes\\weapons\\iron\\ironsword.nif" }
    ], icons, []);
    expect(mappings[0]).toMatchObject({ kind: "exact", provider: "uesp", matchedBy: "display_name", localPath: "/uesp-icons/iron-sword.png" });
    expect(mappings[1]).toMatchObject({ kind: "exact", provider: "uesp", matchedBy: "model_path_exact", localPath: "/uesp-icons/iron-sword.png" });
  });

  it("uses a category-compatible local SkyStore category image when no UESP item image matches", () => {
    const mappings = mapCatalogIcons(
      [{ stableKey: "keizaal.esp:1", name: "Keizaal Moon Shard", category: "Crafting materials" }],
      [uesp("File:Skyrim-Iron Sword.png", "/uesp-icons/iron-sword.png")],
      [uesp("SkyStore miscellaneous artwork.png", "/catalog-icons/misc.png", ["Crafting materials", "Miscellaneous"])]
    );
    expect(mappings[0]).toMatchObject({ kind: "category_fallback", provider: "skystore_category_art", matchedBy: "category_fallback", localPath: "/catalog-icons/misc.png" });
  });

  it("refuses mapping until the local SkyStore category manifest is available", () => {
    expect(() => mapCatalogIcons([{ stableKey: "keizaal.esp:1", name: "Keizaal Moon Shard", category: "Crafting materials" }], [uesp("File:Skyrim-Iron Sword.png", "/uesp-icons/iron-sword.png")], [])).toThrow("SkyStore category artwork");
  });

  it("covers every current catalog item with local category artwork before UESP images are available", async () => {
    const catalog = JSON.parse(await readFile("catalog/generated/skystore-catalog-current.json", "utf8"));
    const fallbacks = JSON.parse(await readFile("catalog/generated/catalog-icons/skystore-category-fallback-manifest.json", "utf8"));
    const mappings = mapCatalogIcons(catalog.items.map((item: { artwork?: { modelPath?: string | null } }) => ({ ...item, modelPath: item.artwork?.modelPath ?? null })), [], fallbacks.files);
    expect(mappings).toHaveLength(catalog.items.length);
    expect(mappings.every((mapping) => mapping.provider === "skystore_category_art" && mapping.localPath.startsWith("/catalog-icons/"))).toBe(true);
  });

  it("does not attach unrelated achievement or badge art to a same-named catalog item", () => {
    const mappings = mapCatalogIcons(
      [{ stableKey: "keizaal.esp:1", name: "Adept", category: "Miscellaneous" }],
      [uesp("File:SR-achievement-Adept.png", "/uesp-icons/achievement-adept.png", ["Category:Skyrim Achievement Icons"])],
      [uesp("SkyStore merchant goods.png", "/catalog-icons/misc.png", ["Miscellaneous", "Tools & supplies"])]
    );
    expect(mappings[0]).toMatchObject({ kind: "category_fallback", localPath: "/catalog-icons/misc.png" });
  });
});
