import type {PlannerItem} from "./planner";
import {lootCatalogIdentity} from "./catalog-identity";
export function withoutQuality(name:string):string {
 return name.replace(/\s*\((?:Pristine|Fine|Superior|Exquisite|Flawless|Epic|Legendary)\)/gi,"").replace(/\s+/g," ").trim();
}
const normalized=(name:string)=>withoutQuality(name).replace(/[()]/g," ").replace(/\s+/g," ").trim().toLowerCase();
export function qualityGroupKey(item:{name:string;plugin:string;formId:string}):string {
 const [plugin,id]=lootCatalogIdentity(item.plugin,item.formId,true).split(":");
 return JSON.stringify([plugin,id,normalized(item.name),"",""]);
}
export function mergeQualityItems(items:(PlannerItem&{overrideTime?:number})[]):PlannerItem[]{
 const groups=new Map<string,(PlannerItem&{overrideTime?:number})[]>();
 for(const item of items){const key=qualityGroupKey(item);groups.set(key,[...(groups.get(key)??[]),item]);}
 return [...groups].map(([key,rows])=>{
  const selected=[...rows].sort((a,b)=>(b.overrideTime??0)-(a.overrideTime??0)||(a.unitValue==null?1:0)-(b.unitValue==null?1:0))[0];
  return {...selected,key,name:withoutQuality(selected.name),customName:withoutQuality(selected.customName),temper:"",leading:rows.some(row=>row.leading),reviewed:rows.some(row=>row.reviewed),excluded:rows.every(row=>row.excluded),quantity:rows.reduce((sum,row)=>sum+row.quantity,0),sourceKeys:rows.flatMap(row=>row.sourceKeys??[row.key])};
 });
}
/** Reconcile old per-quality references without changing historical receipts. */
export function resolveQualityKey(key:string,items:PlannerItem[],name?:string):string {
 const exact=items.find(item=>item.key===key||item.sourceKeys?.includes(key));if(exact)return exact.key;
 try{
  const [plugin,id,rawName,custom]=JSON.parse(key);
  const candidates=items.filter(item=>lootCatalogIdentity(item.plugin,item.formId,true)===lootCatalogIdentity(plugin,id));
  const label=name||custom||rawName;
  const matches=candidates.filter(item=>normalized(item.name)===normalized(label||item.catalogName||""));
  return matches.length===1?matches[0].key:key;
 }catch{return key;}
}
export function resolveBundleLines(lines:{key:string;quantity:number}[],items:PlannerItem[]){
 const merged=new Map<string,number>();for(const line of lines){const key=resolveQualityKey(line.key,items);merged.set(key,(merged.get(key)??0)+line.quantity);}
 return [...merged].map(([key,quantity])=>({key,quantity}));
}
