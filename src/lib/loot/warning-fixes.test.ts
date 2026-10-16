import {describe,it,expect} from "vitest";
import {warningAction,resizeBoxTypes,fixLootWarning} from "./warning-fixes";
import type {PackingSettings} from "./pack-rewards.mjs";
import type {PlannerItem} from "./planner";
const settings:PackingSettings={count:10,margin:.2,general:100,premium:150,exclusive:200,leadersOnly:true,minimumPotions:2,boxTypes:[{tier:"General",count:5,price:100},{tier:"Premium",count:5,price:150}]};
const potion:PlannerItem={key:"p",name:"Potion of Health",category:"Potion",quantity:10,unitValue:20,plugin:"test.esp",formId:"1",customName:"",temper:"",reviewed:true};
describe("warning actions",()=>{
 it("reduces counts to available potions without lowering the guarantee",()=>{
  const result=fixLootWarning([potion],settings,"potions");expect(result.boxes).toHaveLength(5);
  expect(result.settings.minimumPotions).toBe(2);expect(result.margin).toBeGreaterThanOrEqual(.2);
  expect(result.boxes.every(box=>box.lines.reduce((n,l)=>n+l.quantity,0)>=2)).toBe(true);
 });
 it("resizes proportionally, keeping integer positive tiers",()=>{
  expect(resizeBoxTypes(settings,3).boxTypes?.map(r=>r.count)).toEqual([2,1]);
  expect(resizeBoxTypes(settings,1).boxTypes).toHaveLength(1);
 });
 it("does not manufacture missing leads or potions",()=>{
  expect(()=>fixLootWarning([potion],settings,"leads")).toThrow(/No approved leads/);
  expect(()=>fixLootWarning([],settings,"potions")).toThrow(/No potion stock/);
 });
 it("every emitted warning type has a fix or direct review destination",()=>{
  for(const warning of ["3 prices needed","5 excluded or unresolved units are not assigned to boxes","No identified, included event stock is available.","Not enough potions to put at least 2 in every box.","Not enough item units to fill every requested box.","Only 10 boxes have a suitable main reward","2 of 10 boxes have no approved leading reward","10 of 10 boxes have no approved leading reward","2 item units remain in event storage","10 boxes fit the prices and profit target; 20 preferred.","3 materials across 5 standard boxes: fewer than 5 each.","0 materials across 5 standard boxes","Winning-value distribution puts some boxes outside the usual 5–15 material count.","Available rewards prevent the requested winning odds.","Some boxes miss the 70–115% value range","Current stock and reward rules cannot meet the profit target."]){
   const action=warningAction(warning);expect(action.label).toBeTruthy();expect(Boolean(action.fix||action.tab)).toBe(true);
  }
 });
});
