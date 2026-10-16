import {planLoot,type PlannerItem} from "./planner";
import type {PackingResult,PackingSettings} from "./pack-rewards.mjs";

/** Keep exact quantities and relative tier prices; fit whole-gold prices to packed cost. */
export function rebalanceLoot(items:PlannerItem[],settings:PackingSettings):PackingResult {
 const types=settings.boxTypes;
 if(!types?.length)throw Error("Choose exact box quantities before rebalancing.");
 const initial=planLoot(items,settings);
 if(initial.blocked)throw Error(initial.warnings.join(" "));
 const referenceRevenue=types.reduce((sum,row)=>sum+row.count*row.price,0);
 const stockCost=initial.stockValue??initial.knownValue;
 let scale=stockCost/(1-settings.margin)/referenceRevenue;
 let best:PackingResult|undefined;
 const seen=new Set<string>();
 for(let attempt=0;attempt<12;attempt++){
  const boxTypes=types.map(row=>({...row,price:Math.max(1,Math.ceil(row.price*scale-1e-9))}));
  if(boxTypes.some(row=>row.price>10_000_000))throw Error("The profit target requires a box price above 10,000,000g. Add boxes or reduce the target.");
  const key=boxTypes.map(row=>row.price).join(":");if(seen.has(key))break;seen.add(key);
  const candidate=planLoot(items,{...settings,boxTypes});
  if(candidate.blocked){if(best)break;throw Error(candidate.warnings.join(" "));}
  if((candidate.margin??0)>=settings.margin-1e-9&&(!best||candidate.revenue!<best.revenue!))best=candidate;
  const next=candidate.knownValue/(1-settings.margin)/referenceRevenue;
  if(Math.abs(next-scale)<1e-10)break;
  scale=next;
 }
 if(!best)throw Error("Unable to meet the profit target with these quantities and reward rules. Add boxes or change prices.");
 return best;
}
