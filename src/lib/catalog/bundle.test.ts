import { describe, expect, it } from "vitest";
import { CatalogBundleError, parseBuilderBundle } from "./bundle";
import { CatalogImportFileError, resolveCatalogImportFile } from "./import-file";
import { createManualCatalogItemCommand } from "./manual";

const bundle = {
  schemaVersion: "1",
  version: "v1-catalog-test",
  generatedAt: "2026-08-05T00:00:00+00:00",
  source: { game: "Skyrim", release: "AE", dataFolder: "D:\\Keizaal\\Data", loadOrderSha256: "a".repeat(64) },
  items: [{
    id: "00000000-0000-4000-8000-000000000101",
    stableKey: "skyrim.esm:00012eb7",
    name: "Iron Sword",
    editorId: "IronSword",
    plugin: "skyrim.esm",
    recordType: "Weapon",
    formId: "00012eb7",
    category: "Weapons",
    gameValue: 25,
    weight: 9,
    artwork: { status: 0, fallbackIcon: "/catalog-icons/weapon.png", modelPath: "meshes/weapons/iron/sword.nif" },
    aliases: ["Iron Sword"],
    metadata: { damage: "8" }
  }]
};

describe("builder catalog bundle", () => {
  it("accepts the .NET numeric enum form and retains non-blocking unresolved artwork", () => {
    const parsed = parseBuilderBundle(bundle);
    expect(parsed.bundle.items[0].artwork.status).toBe("unresolved");
    expect(parsed.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "artwork_unresolved", blocking: false })]));
  });

  it("rejects a bundle without a safe image fallback", () => {
    const invalid = structuredClone(bundle);
    invalid.items[0].artwork.fallbackIcon = "https://untrusted.example/weapon.svg";
    expect(() => parseBuilderBundle(invalid)).toThrow(CatalogBundleError);
  });

  it("rejects mismatched stable keys before staging", () => {
    const invalid = structuredClone(bundle);
    invalid.items[0].stableKey = "other.esp:00000001";
    expect(() => parseBuilderBundle(invalid)).toThrow(/invalid/i);
  });

  it("does not allow an import path to escape its configured directory", () => {
    expect(resolveCatalogImportFile("catalog.json", "D:\\SkyStore\\imports")).toBe("D:\\SkyStore\\imports\\catalog.json");
    expect(() => resolveCatalogImportFile("../secrets.json", "D:\\SkyStore\\imports")).toThrow(CatalogImportFileError);
    expect(() => resolveCatalogImportFile("C:\\Windows\\system.json", "D:\\SkyStore\\imports")).toThrow(CatalogImportFileError);
  });

  it("requires a safe category fallback for manual catalog items", () => {
    expect(createManualCatalogItemCommand.safeParse({ name: "Keizaal Crystal", category: "Crafting materials", fallbackIcon: "/catalog-icons/misc.png" }).success).toBe(true);
    expect(createManualCatalogItemCommand.safeParse({ name: "Keizaal Crystal", category: "Crafting materials", fallbackIcon: "https://outside.example/icon.svg" }).success).toBe(false);
  });
});
