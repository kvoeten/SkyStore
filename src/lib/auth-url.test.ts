import { describe, expect, it } from "vitest";
import { canonicalLoginUrl } from "./auth-url";

describe("canonicalLoginUrl", () => {
  it("moves a local IP login onto the configured OAuth callback host", () => {
    expect(canonicalLoginUrl("http://localhost:3000", "127.0.0.1:3000", "/dashboard"))
      .toBe("http://localhost:3000/login?returnTo=%2Fdashboard");
  });

  it("does nothing when the request already uses the canonical host", () => {
    expect(canonicalLoginUrl("http://localhost:3000", "localhost:3000", "/dashboard")).toBeNull();
  });

  it("does not preserve an external return destination", () => {
    expect(canonicalLoginUrl("http://localhost:3000", "127.0.0.1:3000", "//example.com"))
      .toBe("http://localhost:3000/login");
  });

  it("ignores missing or invalid configuration", () => {
    expect(canonicalLoginUrl(undefined, "127.0.0.1:3000")).toBeNull();
    expect(canonicalLoginUrl("not a url", "127.0.0.1:3000")).toBeNull();
  });
});
