import {expect,it} from "vitest";
import type {PlannerItem} from "./planner";
import {mergeQualityItems,resolveQualityKey,resolveBundleLines,withoutQuality} from "./quality-groups";
const item=(name:string,quantity:number,temper=""):PlannerItem=>({key:JSON.stringify(["clothes.esp","597B",name,name,temper]),name,quantity,temper,plugin:"clothes.esp",formId:"1000597B",customName:name,category:"Clothing",unitValue:100});
it("combines quality tags and quantities, but preserves named variants and base IDs",()=>{
 const pristine=item("Fine Clothes (Blood Moon) (Pristine)",2,"1.6"),plain=item("Fine Clothes (Blood Moon)",3);
 const grouped=mergeQualityItems([pristine,plain,item("Fine Clothes (Spring Pink)",1),{...plain,key:"other",formId:"1000597C"}]);
 expect(grouped).toHaveLength(3);
 expect(grouped[0].name).toBe("Fine Clothes (Blood Moon)");
 expect(grouped[0].quantity).toBe(5);
 expect(grouped[0].temper).toBe("");
 expect(pristine.quantity).toBe(2);
 expect(resolveQualityKey(pristine.key,grouped)).toBe(grouped[0].key);
 expect(resolveBundleLines([{key:pristine.key,quantity:1},{key:plain.key,quantity:1}],grouped)).toEqual([{key:grouped[0].key,quantity:2}]);
});
it("retains leader approvals and uses the most recently overridden price",()=>{
 const groups=mergeQualityItems([{...item("Sword (Pristine)",1),leading:true,unitValue:10,overrideTime:1},{...item("Sword",2),leading:false,unitValue:20,overrideTime:2}]);
 expect(groups[0].leading).toBe(true);expect(groups[0].unitValue).toBe(20);
 expect(withoutQuality("Fine Clothes (Blood Moon) (Pristine)")).toBe("Fine Clothes (Blood Moon)");
});
it("reconciles removed quality variants in historical reservations",()=>{
 const old=item("Sword (Pristine)",1,"1.6"),current=mergeQualityItems([item("Sword",5)]);
 expect(resolveQualityKey(old.key,current,old.name)).toBe(current[0].key);
});
