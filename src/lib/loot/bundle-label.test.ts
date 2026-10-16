import {expect,it} from "vitest";
import {bundleLabel} from "./bundle-label";
import {lootCommand} from "./commands";
it("accepts sets without a name and labels their selected contents",()=>{
  expect(lootCommand.safeParse({action:"bundle",enabled:true,lines:[{key:"ring",quantity:2}]}).success).toBe(true);
  expect(bundleLabel([{name:"Ring",quantity:2},{name:"Necklace",quantity:1}])).toBe("2 × Ring + 1 × Necklace");
});
it("labels complete book sets and bounds long generated names",()=>{
  expect(bundleLabel(Array.from({length:7},(_,k)=>({name:`A Dance in Fire, v${k+1}`,quantity:1})))).toBe("A Dance in Fire — complete set");
  expect(bundleLabel([{name:"A".repeat(200),quantity:1}]).length).toBeLessThanOrEqual(120);
});
