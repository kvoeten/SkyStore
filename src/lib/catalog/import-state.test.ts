import { describe, expect, it } from "vitest";
import { catalogImportDisposition } from "./import-state";

describe("catalog import bootstrap", () => {
  it("stages an unknown or inactive version", () => {
    expect(catalogImportDisposition(undefined, "a".repeat(64))).toBe("stage");
    expect(catalogImportDisposition({ status: "staged", sourceLoadOrderHash: "a".repeat(64) }, "a".repeat(64))).toBe("stage");
  });

  it("treats the exact active bundle as an idempotent deployment", () => {
    expect(catalogImportDisposition({ status: "active", sourceLoadOrderHash: "a".repeat(64) }, "a".repeat(64))).toBe("already_active");
  });

  it("rejects reuse of an active version name for different source data", () => {
    expect(() => catalogImportDisposition({ status: "active", sourceLoadOrderHash: "a".repeat(64) }, "b".repeat(64))).toThrow(/different load-order hash/i);
  });
});
