import {expect,it} from "vitest";
import {compareLootNames,alphabetizeBoxContents,alphabetizeLootDashboard} from "./presentation";
import type {LootDashboard} from "./service";
import type {PackedBox,PackingItem} from "./pack-rewards.mjs";
it("sorts names naturally and case-insensitively",()=>{
 expect([{name:"Zinc"},{name:"Book 10"},{name:"apple"},{name:"Book 2"}].sort(compareLootNames).map(i=>i.name)).toEqual(["apple","Book 2","Book 10","Zinc"]);
});
it("sorts displayed box contents without changing saved rewards or quantities",()=>{
 const lines=[{name:"Wheat",key:"w",quantity:4},{name:"Apple",key:"a",quantity:2}] as PackingItem[];
 const box={id:"001",lines,mainLines:lines,sale:100,value:40} as PackedBox;
 const shown=alphabetizeBoxContents(box);
 expect(shown.lines.map(i=>i.name)).toEqual(["Apple","Wheat"]);
 expect(shown.mainLines.map(i=>i.quantity)).toEqual([2,4]);
 expect(box.lines.map(i=>i.name)).toEqual(["Wheat","Apple"]);
 expect(shown.id).toBe(box.id);expect(shown.value).toBe(box.value);
});
it("alphabetizes storage and pickers while preserving the source snapshot",()=>{
 const items=[{key:"z",name:"Zinc"},{key:"a",name:"Apple"}];
 const source={manage:true,boxes:[],storage:[{items}],available:items,events:[],users:[],bundles:[],purchases:[],assignments:[]} as unknown as LootDashboard;
 const shown=alphabetizeLootDashboard(source);
 if(!shown.manage)throw Error("Expected management view");
 expect(shown.storage[0].items.map(i=>i.name)).toEqual(["Apple","Zinc"]);
 expect(shown.available.map(i=>i.name)).toEqual(["Apple","Zinc"]);
 expect(items.map(i=>i.name)).toEqual(["Zinc","Apple"]);
});
