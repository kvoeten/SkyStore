import {expect,it} from "vitest";
import {lootItemLabel} from "./item-label";
it("restores named clothing variants and preserves condition",()=>{
 expect(lootItemLabel("Fine Clothes (Pristine)","Fine Clothes Blood Moon")).toBe("Fine Clothes (Blood Moon) (Pristine)");
 expect(lootItemLabel("Fine Clothes Blood Moon (Pristine)","Fine Clothes Blood Moon")).toBe("Fine Clothes (Blood Moon) (Pristine)");
 expect(lootItemLabel("Fine Clothes (Blood Moon)","Fine Clothes Blood Moon")).toBe("Fine Clothes (Blood Moon)");
});
it("does not invent variant names absent from the winning game record",()=>{
 expect(lootItemLabel("Fine Clothes (Pristine)","Fine Clothes")).toBe("Fine Clothes (Pristine)");
 expect(lootItemLabel("Fine Clothes","Fine Clothes")).toBe("Fine Clothes");
 expect(lootItemLabel("Fine Clothes Special Occasion","Fine Clothes Blood Moon")).toBe("Fine Clothes Special Occasion");
});
