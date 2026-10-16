import {planLoot,type PlannerItem} from "./planner";
import {rebalanceLoot} from "./rebalance";
import type {PackingSettings,PackingResult} from "./pack-rewards.mjs";
export const FIX_KINDS=["profit","potions","stock","leads","materials","odds","leftovers","counts","value"] as const;
export type FixKind=typeof FIX_KINDS[number];
export function warningAction(text:string):{label:string;fix?:FixKind;tab?:string}{
 if(/prices needed/i.test(text))return {label:"Enter missing prices",tab:"event"};
 if(/excluded or unresolved|No identified/i.test(text))return {label:"Review excluded items",tab:"excluded"};
 if(/Not enough potions/i.test(text))return {label:"Reduce boxes to fit potions",fix:"potions"};
 if(/Not enough item units/i.test(text))return {label:"Reduce boxes to available stock",fix:"stock"};
 if(/profit target/i.test(text)&&!/preferred/.test(text))return {label:"Rebalance To Fit Profit",fix:"profit"};
 if(/suitable main reward|no approved leading reward/i.test(text)){
  const missing=/^(\d+) of (\d+)/.exec(text);
  if(missing&&missing[1]===missing[2])return {label:"Choose leading rewards",tab:"leaders"};
  return {label:"Reduce boxes to available leads",fix:"leads"};
 }
 if(/remain in event storage/i.test(text))return {label:"Add a box for leftover stock",fix:"leftovers"};
 if(/preferred/.test(text))return {label:"Use feasible box count",fix:"counts"};
 if(/^0 materials/.test(text))return {label:"Review material stock",tab:"event"};
 if(/materials across|material count/i.test(text))return {label:"Fit box count to materials",fix:"materials"};
 if(/winning odds/i.test(text))return {label:"Fit winning odds to stock",fix:"odds"};
 if(/70–115%/.test(text))return {label:"Fit prices to contents value",fix:"value"};
 return {label:"Review event storage",tab:"event"};
}
export function resizeBoxTypes(settings:PackingSettings,total:number):PackingSettings {
 const source=settings.boxTypes;
 if(!source?.length)throw Error("Choose exact box quantities to use automatic fixes.");
 total=Math.max(1,Math.min(1000,Math.floor(total)));
 const old=source.reduce((n,row)=>n+row.count,0);
 const rows=source.map(row=>({...row,count:Math.floor(total*row.count/old),remainder:total*row.count/old%1}));
 let left=total-rows.reduce((n,row)=>n+row.count,0);
 for(const row of [...rows].sort((a,b)=>b.remainder-a.remainder)){if(left--<=0)break;row.count++;}
 return {...settings,count:total,boxTypes:rows.filter(row=>row.count>0).map(({tier,count,price})=>({tier,count,price}))};
}
export function fixLootWarning(items:PlannerItem[],settings:PackingSettings,kind:FixKind):PackingResult {
 if(kind==="profit")return rebalanceLoot(items,settings);
 const initial=planLoot(items,settings),count=settings.boxTypes?.reduce((n,row)=>n+row.count,0)??settings.count;
 const available=items.filter(i=>!i.excluded&&i.quantity>0&&(i.catalogItemId||i.reviewed));
 let changed=settings;
 let target:RegExp;
 switch(kind){
  case "potions":{
   const potions=available.filter(i=>i.category==="Potion").reduce((n,i)=>n+i.quantity,0);
   const total=Math.floor(potions/Math.max(1,settings.minimumPotions??0));
   if(total<1)throw Error("No potion stock can satisfy this minimum. Add potions or change the minimum.");
   changed=resizeBoxTypes(settings,Math.min(count,total));target=/Not enough potions/;break;
  }
  case "stock":changed=resizeBoxTypes(settings,Math.min(count,available.reduce((n,i)=>n+i.quantity,0)));target=/Not enough item units/;break;
  case "leads":{
   const leads=initial.boxes.filter(b=>b.mainLines.length>0).length;
   if(!leads)throw Error("No approved leads are available. Mark leaders in Event storage or create a Leading reward bundle.");
   changed=resizeBoxTypes(settings,leads);target=/no approved leading reward|suitable main reward/;break;
  }
  case "leftovers":changed=resizeBoxTypes(settings,count+1);target=/remain in event storage/;break;
  case "counts":changed=resizeBoxTypes(settings,initial.boxes.length);target=/preferred/;break;
  case "materials":{
   const materials=available.filter(i=>i.category==="Material").reduce((n,i)=>n+i.quantity,0);
   if(!materials)throw Error("There are no materials to distribute. Add stock or keep the current boxes.");
   const leadOnly=initial.boxes.filter(b=>b.leadOnly).length;
   changed=resizeBoxTypes(settings,leadOnly+Math.max(1,Math.ceil(materials/10)));target=/materials across|material count/;break;
  }
  case "odds":{
   const group=initial.odds?.filter(row=>row.tier!=="Special")??[];
   const total=group.reduce((n,row)=>n+row.total,0),wins=group.reduce((n,row)=>n+row.winners,0);
   const actual=total?wins/total*100:0;
   for(const percent of [...new Set([Math.round(actual),Math.floor(actual),Math.ceil(actual)])]){
    if(percent===0)continue;
    const candidate=planLoot(items,{...settings,winPercent:percent});
    if(!candidate.blocked&&!candidate.warnings.some(w=>/requested winning odds/.test(w)))return candidate;
   }
   throw Error("These rewards cannot meet a non-zero winning-odds target automatically. Change the prize pool or winning target.");
  }
  case "value":{
   if(initial.blocked)throw Error(initial.warnings.join(" "));
   const tiers=[...new Set(initial.boxes.map(b=>b.tier))];
   const boxTypes=tiers.filter((tier):tier is "General"|"Premium"|"Exclusive"=>tier!=="Special").map(tier=>{
    const boxes=initial.boxes.filter(b=>b.tier===tier);
    return {tier,count:boxes.length,price:Math.max(1,Math.ceil(boxes.reduce((n,b)=>n+b.value,0)/boxes.length/(1-settings.margin)))};
   });
   changed={...settings,boxTypes};target=/70–115%/;break;
  }
 }
 const result=rebalanceLoot(items,changed);
 if(result.warnings.some(w=>target.test(w)))throw Error("The available rewards cannot resolve this warning without changing other rules. Your saved plan was not changed.");
 return result;
}
