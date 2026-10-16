import {formatGold} from "@/lib/money";
import {lootTotals} from "@/lib/loot/summary";
import type {PackingResult} from "@/lib/loot/pack-rewards.mjs";
export function LootPlanSummary({plan}:{plan:PackingResult}){
 const totals=lootTotals(plan);
 return <div className="loot-summary" aria-label="Event profit summary">{[["Boxes",totals.boxes],["Packed cost",formatGold(totals.cost)],["Revenue",formatGold(totals.revenue)],["Profit",formatGold(totals.profit)],["Profit margin",`${(totals.margin*100).toFixed(1)}%`]].map(([label,value])=><article className="card" key={label}><small>{label}</small><b>{value}</b></article>)}</div>;
}
