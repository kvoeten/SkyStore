import { describe, expect, it } from "vitest";
import { productGroupForItem } from "./product-groups";

describe("published product groups", () => {
  it("maps every stated fur cloak variant to the shared Fur Capes family", () => {
    expect(productGroupForItem({ name: "Fur Cloak (Black)" })?.key).toBe("fur-capes");
    expect(productGroupForItem({ name: "Fur Cloak (Snowy Sabre)" })?.label).toBe("Fur Capes");
  });

  it("does not group unrelated generic fur capes", () => {
    expect(productGroupForItem({ name: "Fur Cape" })).toBeNull();
    expect(productGroupForItem({ name: "Dark Fur Cape" })).toBeNull();
  });
});
