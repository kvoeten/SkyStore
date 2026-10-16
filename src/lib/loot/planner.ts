import { generateAll, type PackingResult, type PackingSettings } from "./pack-rewards.mjs";
import { isIgnoredStorageItem, type StorageItem } from "./storage-import";
export type PlannerItem = StorageItem & { excluded?: boolean; reviewed?: boolean; leading?: boolean; catalogItemId?:string; catalogName?:string; sourceKeys?:string[] };
export const LOOT_CATEGORIES = ["Armor", "Weapon", "Clothing", "Jewellery", "Book", "Potion", "Food", "Material", "Joke", "Other", "Review"] as const;
export function planLoot(items: PlannerItem[], settings: PackingSettings, seed = 42): PackingResult {
  const unresolved=(item:PlannerItem)=>!item.catalogItemId&&!item.reviewed&&(item.category==="Review"||/^Kzl/i.test(item.name));
  const skipped=items.filter(item=>item.quantity>0&&(item.excluded||unresolved(item))&&!isIgnoredStorageItem(item.name,item.plugin,item.formId));
  const warning=skipped.length?`${skipped.reduce((sum,item)=>sum+item.quantity,0)} excluded or unresolved units are not assigned to boxes: ${skipped.map(item=>item.name).join(", ")}.`:null;
  const eligible = items.filter((item) => !isIgnoredStorageItem(item.name,item.plugin,item.formId) && !item.excluded && !unresolved(item) && item.quantity > 0).map(item=>item.category==="Review"?{...item,category:"Other"}:item);
  if (!eligible.length)return {boxes:[],settings,units:0,knownValue:0,missingRows:0,missingUnits:0,blocked:"stock",warnings:[...(warning?[warning]:[]),"No identified, included event stock is available."]};
  if (eligible.reduce((sum, item) => sum + item.quantity, 0) > 25_000) throw new Error("This event exceeds the 25,000-item planner limit. Split it into smaller events.");
  const plan=generateAll(eligible.map((item) => ({
    key: item.key, name: item.name, quantity: item.quantity, role: item.category,
    value: /^Amulet of /i.test(item.name) ? 150 : item.unitValue, container: "EVENT STORAGE", leading:item.leading??false,
  })), {...settings,leadersOnly:settings.leadersOnly??(eligible.some(item=>item.leading)||!!settings.leaderBundles?.length)}, seed);
  if(warning)plan.warnings.unshift(warning);
  return plan;
}
