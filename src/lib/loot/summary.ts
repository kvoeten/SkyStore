import type {PackingResult,PackingSettings} from "./pack-rewards.mjs";
export function lootTotals(plan:PackingResult){
 const revenue=plan.boxes.reduce((n,b)=>n+b.sale,0),cost=plan.boxes.reduce((n,b)=>n+b.value,0);
 return {boxes:plan.boxes.length,cost,revenue,profit:revenue-cost,margin:revenue?(revenue-cost)/revenue:0};
}
export function sameEventSetup(name:string,settings:PackingSettings,saved:{name:string;settings:PackingSettings}){
 const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,canonical(v)])):value;
 return name.trim()===saved.name&&JSON.stringify(canonical(settings))===JSON.stringify(canonical(saved.settings));
}
