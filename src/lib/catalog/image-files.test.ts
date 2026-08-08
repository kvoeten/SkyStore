import { describe, expect, it } from "vitest";
import { resolveCatalogImage } from "./image-files";

describe("resolveCatalogImage", () => {
  it("resolves a supported flat image name inside the catalog root", () => {
    expect(resolveCatalogImage(["SR-icon-weapon-Iron-Sword-a1b2.png"], "/catalog/uesp")).toEqual({
      filePath: expect.stringMatching(/[\\/]catalog[\\/]uesp[\\/]SR-icon-weapon-Iron-Sword-a1b2\.png$/),
      contentType: "image/png"
    });
  });

  const invalidPaths: Array<readonly string[] | undefined> = [
    undefined,
    [],
    ["folder", "icon.png"],
    [".."],
    ["../secret.png"],
    ["folder/icon.png"],
    ["folder\\icon.png"],
    ["icon.exe"]
  ];

  for (const segments of invalidPaths) {
    it(`rejects unsafe or unsupported paths: ${JSON.stringify(segments)}`, () => {
      expect(resolveCatalogImage(segments, "/catalog/uesp")).toBeNull();
    });
  }
});
