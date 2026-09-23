import { describe, expect, it } from "vitest";
import { marketReferenceValue } from "./reference-value";

describe("marketReferenceValue", () => {
  it("uses direct street trade before a store guide", () => {
    expect(marketReferenceValue({ streetValue: 12, officialCustomerPays: 15 })).toBe(12);
  });

  it("uses a store guide until street trade is reported", () => {
    expect(marketReferenceValue({ officialCustomerPays: 15 })).toBe(15);
  });

  it("does not turn a store margin into street value", () => {
    expect(marketReferenceValue({ officialCustomerPays: null })).toBeNull();
  });
});
