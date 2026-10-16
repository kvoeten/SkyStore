import {expect,it} from "vitest";
import {lootCatalogIdentity} from "./catalog-identity";
it("resolves Blood Moon's chest ID to its precise catalog record across load orders",()=>{
 const catalog=lootCatalogIdentity("KzlOnlineMods.esp","0000597B");
 expect(lootCatalogIdentity("kzlonlinemods.esp","1000597B",true)).toBe(catalog);
 expect(lootCatalogIdentity("KzlOnlineMods.esp","0F00597B",true)).toBe(catalog);
 expect(lootCatalogIdentity("Skyrim.esm","000F8713",true)).not.toBe(catalog);
 expect(lootCatalogIdentity("Skyrim.esm","000F8715",true)).not.toBe(catalog);
});
it("handles light plugins and preserves plugin identity",()=>{
 expect(lootCatalogIdentity("Clothes.esp","FE00A001",true)).toBe(lootCatalogIdentity("clothes.esp","00000001"));
 expect(lootCatalogIdentity("Other.esp","1000597B",true)).not.toBe(lootCatalogIdentity("KzlOnlineMods.esp","0000597B"));
});
