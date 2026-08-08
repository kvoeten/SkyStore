import { describe, expect, it } from "vitest";
import { resolveCatalogImage } from "./image-files";

describe("resolveCatalogImage", () => {
  it("resolves a supported flat image name inside the catalog root", () => {
    expect(resolveCatalogImage(["87ca8265-5b8f-5b74-a1c3-3aea4c2a6167.png"], "/catalog/renders")).toEqual({
      filePath: expect.stringMatching(/[\\/]catalog[\\/]renders[\\/]87ca8265-5b8f-5b74-a1c3-3aea4c2a6167\.png$/),
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
      expect(resolveCatalogImage(segments, "/catalog/renders")).toBeNull();
    });
  }
});
