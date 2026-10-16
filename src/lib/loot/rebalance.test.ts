import {describe,it,expect} from "vitest";
import {rebalanceLoot} from "./rebalance";
import {validateAll,type PackingSettings} from "./pack-rewards.mjs";
import type {PlannerItem} from "./planner";
const stock:PlannerItem[]=[{key:"potion",name:"Potion of Health",category:"Potion",quantity:20,unitValue:20,plugin:"test.esp",formId:"1",customName:"",temper:"",reviewed:true},{key:"ore",name:"Iron Ore",category:"Material",quantity:20,unitValue:1,plugin:"test.esp",formId:"2",customName:"",temper:"",reviewed:true}];
const settings:PackingSettings={count:100,margin:.2,general:120,premium:150,exclusive:200,minimumPotions:2,leadersOnly:true,boxTypes:[{tier:"General",count:2,price:20},{tier:"Premium",count:2,price:30}]};
describe("profit rebalancing",()=>{
 it("keeps fewer exact boxes and potion minimums, fitting integer prices to profit",()=>{
  const result=rebalanceLoot(stock,settings);
  expect(result.boxes).toHaveLength(4);expect(result.margin).toBeGreaterThanOrEqual(.2);
  expect(result.settings.boxTypes?.map(r=>r.count)).toEqual([2,2]);
  expect(result.boxes.every(b=>b.lines.filter(l=>l.role==="Potion").reduce((n,l)=>n+l.quantity,0)>=2)).toBe(true);
  expect(result.boxes.every(b=>Number.isInteger(b.sale))).toBe(true);
  expect(result.units).toBe(40);expect(result.revenue!-result.knownValue).toBe(result.profit);
  expect(validateAll(stock.map(i=>({...i,role:i.category,value:i.unitValue,container:"EVENT STORAGE"})),result)).toBe(true);
 });
 it("never prices excluded prizes into box revenue",()=>{
  const result=rebalanceLoot([...stock,{...stock[0],key:"lottery",quantity:1,unitValue:10000,excluded:true}],settings);
  expect(result.knownValue).toBe(420);expect(result.revenue).toBeLessThan(600);
 });
 it("does not invent prices or potions",()=>{
  expect(()=>rebalanceLoot([{...stock[0],unitValue:null}],settings)).toThrow(/prices needed/);
  expect(()=>rebalanceLoot([{...stock[0],quantity:1}],settings)).toThrow(/Not enough potions/);
 });
 it("requires exact box setup",()=>expect(()=>rebalanceLoot(stock,{...settings,boxTypes:undefined})).toThrow(/exact box quantities/));
});
