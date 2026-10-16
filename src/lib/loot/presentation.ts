import type { LootDashboard } from "./service";
import type { PackedBox } from "./pack-rewards.mjs";
const alphabetic=new Intl.Collator("en",{numeric:true,sensitivity:"base"});
export const compareLootNames=(a:{name:string},b:{name:string})=>alphabetic.compare(a.name,b.name);
export const alphabetizeBoxContents=(box:PackedBox):PackedBox=>({...box,lines:[...box.lines].sort(compareLootNames),mainLines:[...box.mainLines].sort(compareLootNames)});
/** Presentation only: never reorder the allocator's stock or saved draws. */
export function alphabetizeLootDashboard(data:LootDashboard):LootDashboard {
  const boxes=data.boxes.map(box=>({...box,...("contents" in box&&box.contents?{contents:alphabetizeBoxContents(box.contents)}:{})}));
  if(!data.manage)return {...data,boxes};
  const names=new Map(data.users.map(user=>[user.id,user.displayName??user.name??user.discordId]));
  const customer=(a:{userId:string|null},b:{userId:string|null})=>alphabetic.compare(names.get(a.userId??"")??"Unassigned",names.get(b.userId??"")??"Unassigned");
  const itemNames=new Map(data.storage.flatMap(storage=>storage.items.map(item=>[item.key,item.name] as const)));
  return {...data,boxes,
    storage:data.storage.map(storage=>({...storage,items:[...storage.items].sort(compareLootNames)})),
    available:[...data.available].sort(compareLootNames),
    events:data.events.map(event=>({...event,plan:event.plan?{...event.plan,boxes:event.plan.boxes.map(alphabetizeBoxContents)}:null})).sort(compareLootNames),
    users:[...data.users].sort((a,b)=>alphabetic.compare(names.get(a.id)!,names.get(b.id)!)),
    bundles:data.bundles.map(bundle=>({...bundle,lines:[...bundle.lines].sort((a,b)=>alphabetic.compare(itemNames.get(a.key)??a.key,itemNames.get(b.key)??b.key))})).sort(compareLootNames),
    purchases:[...data.purchases].sort(customer),
    assignments:data.assignments.map(box=>({...box,contents:alphabetizeBoxContents(box.contents)})).sort(customer),
  };
}
export function alphabetizePlan(plan:import("./pack-rewards.mjs").PackingResult){return {...plan,boxes:plan.boxes.map(alphabetizeBoxContents)};}
