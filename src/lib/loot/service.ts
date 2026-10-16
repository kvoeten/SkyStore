import { createHash, randomInt, randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/runtime";
import { auditEvents, baseCostRules, catalogItems, chestPriceOverrides, chestStorage, lootBoxes, lootEvents, lootLeadingBundles, lootPurchases, officialPriceRules, publicMarketReports, users } from "@/db/schema";
import type { AccessContext } from "@/lib/authorization";
import confirmedValues from "./confirmed-values.json";
import { canManageWhiterunStorage } from "./access";
import { importStorageCsv, isIgnoredStorageItem, type StorageKind, type StorageSnapshot } from "./storage-import";
import { planLoot, type PlannerItem } from "./planner";
import type { LootCommand } from "./commands";
import { defaultSettings } from "./pack-rewards.mjs";
import { bundleLabel } from "./bundle-label";
import { lootItemLabel } from "./item-label";
import { lootCatalogIdentity } from "./catalog-identity";
import {mergeQualityItems,qualityGroupKey,resolveQualityKey,resolveBundleLines,withoutQuality} from "./quality-groups";

const knownValues = confirmedValues as Record<string, {category:string;unitValue:number}>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class LootError extends Error {
  constructor(message:string, public status=409) { super(message); }
}
function owner(context:AccessContext|null): asserts context is AccessContext {
  if (!canManageWhiterunStorage(context)) throw new LootError("Only the Whiterun store owner and designated administrator can manage storage.",403);
}
async function lock(tx:Tx) { await tx.execute(sql`select pg_advisory_xact_lock(193733, 1)`); }
async function audit(tx:Tx, context:AccessContext, action:string, entityId:string, after:unknown) {
  await tx.insert(auditEvents).values({actorId:context.userId,action:`loot.${action}`,entityType:"loot_event",entityId,after});
}
function classify(name:string, recordType?:string, category?:string):string {
  if (/burned book|ruined book/i.test(name)) return "Joke";
  if (/potion|draught|philter|elixir|ice wraith essence/i.test(name)) return "Potion";
  if (/jewel/i.test(category??"") || /^Amulet of /i.test(name)) return "Jewellery";
  if (recordType==="Weapon") return "Weapon";
  if (recordType==="Armor") return /clothing|cloak|robe|clothes/i.test(category??name) ? "Clothing" : "Armor";
  if (recordType==="Book") return "Book";
  if (recordType==="Ingredient" || /ore|ingot|material|gem/i.test(category??"")) return "Material";
  if (/food|drink/i.test(category??"")) return "Food";
  return recordType?"Other":"Review";
}
/** Resolve references only when no confirmed user override exists. Never infer zero. */
async function enrich(snapshot:StorageSnapshot):Promise<PlannerItem[]> {
  snapshot={...snapshot,items:snapshot.items.filter(item=>!isIgnoredStorageItem(item.name,item.plugin,item.formId))};
  const [catalog, overrides] = await Promise.all([
    db.select({id:catalogItems.id,plugin:catalogItems.plugin,formId:catalogItems.localFormId,name:catalogItems.displayName,editorId:catalogItems.editorId,recordType:catalogItems.recordType,category:catalogItems.category}).from(catalogItems).where(eq(catalogItems.status,"active")),
    db.select().from(chestPriceOverrides),
  ]);
  const byIdentity = new Map(catalog.map((row)=>[lootCatalogIdentity(row.plugin??"",row.formId??""),row]));
  const matches = snapshot.items.map((item)=>{
    return byIdentity.get(lootCatalogIdentity(item.plugin,item.formId,true));
  });
  const ids=[...new Set(matches.flatMap((row)=>row?[row.id]:[]))],now=new Date();
  const prices=new Map<string,number>(),pricedAt=new Map<string,number>();
  if(ids.length) {
    const [base,sales,reports]=await Promise.all([
      db.select().from(baseCostRules).where(and(inArray(baseCostRules.itemId,ids),lte(baseCostRules.effectiveFrom,now),or(isNull(baseCostRules.effectiveTo),gte(baseCostRules.effectiveTo,now)))),
      db.select().from(officialPriceRules).where(and(inArray(officialPriceRules.itemId,ids),eq(officialPriceRules.side,"customer_pays"),lte(officialPriceRules.effectiveFrom,now),or(isNull(officialPriceRules.effectiveTo),gte(officialPriceRules.effectiveTo,now)))),
      db.select().from(publicMarketReports).where(and(inArray(publicMarketReports.itemId,ids),eq(publicMarketReports.status,"approved"),eq(publicMarketReports.locationType,"street_sale"),lte(publicMarketReports.occurrenceAt,now))),
    ]);
    const references=[
      ...sales.map((row)=>({id:row.itemId,value:row.maximumSeptims/row.quantity,at:row.effectiveFrom,label:row.sourceLabel})),
      ...base.map((row)=>({id:row.itemId,value:row.totalSeptims/row.quantity,at:row.effectiveFrom,label:row.sourceLabel})),
      ...reports.map((row)=>({id:row.itemId,value:row.totalSeptims/row.quantity,at:row.occurrenceAt,label:"Approved street report"})),
    ].filter((row)=>!/provisional|estimat|unconfirmed/i.test(row.label));
    for(const row of references) if(row.at.getTime()>=(pricedAt.get(row.id)??0)) {prices.set(row.id,row.value);pricedAt.set(row.id,row.at.getTime());}
  }
  const byOverride=new Map(overrides.map((row)=>[row.itemKey,row]));
  return mergeQualityItems(snapshot.items.map((item,index)=>{
    const catalogItem=matches[index];
    const rawName=item.name===item.formId?(catalogItem?.name??item.name):item.name;
    const name=lootItemLabel(rawName,catalogItem?.name);
    const override=byOverride.get(qualityGroupKey({...item,name}))??byOverride.get(item.key);
    const known=knownValues[rawName]??knownValues[name];
    const identified=Boolean(catalogItem||override?.reviewed);
    const category=(override?.category&&override.category!=="Review"?override.category:undefined)??known?.category??classify(name,catalogItem?.recordType,catalogItem?.category);
    return {...item,name,catalogItemId:catalogItem?.id,catalogName:catalogItem?.name,overrideTime:override?.updatedAt.getTime(),
      category:identified&&category==="Review"?"Other":category,
      unitValue:/^Amulet of /i.test(name)?150:override?override.unitValue==null?null:Number(override.unitValue):known?.unitValue??(catalogItem?prices.get(catalogItem.id)??null:null),
      reviewed:identified,excluded:!identified||(override?.excluded??false),leading:override?.leading??false,
    };
  }).filter(item=>!isIgnoredStorageItem(item.name)));
}
async function availableEventItems(tx:Tx, storage:typeof chestStorage.$inferSelect):Promise<PlannerItem[]> {
  const source=await enrich({kind:"event",containerId:"000C83B1",capturedAt:storage.capturedAt.toISOString(),session:"",items:storage.items});
  const reserved=await tx.select({contents:lootBoxes.contents,fulfilledAt:lootBoxes.fulfilledAt}).from(lootBoxes);
  const used=new Map<string,number>();
  for(const box of reserved) {
    // Pending handovers are physically still in the captured chest. Handovers
    // after the capture must also be deducted; earlier ones are already absent.
    if(box.fulfilledAt&&box.fulfilledAt<=storage.capturedAt) continue;
    for(const line of box.contents.lines){const key=resolveQualityKey(line.key,source,line.name);used.set(key,(used.get(key)??0)+line.quantity);}
  }
  return source.map((item)=>({...item,quantity:Math.max(0,item.quantity-(used.get(item.key)??0))}));
}
export async function getLootDashboard(context:AccessContext|null) {
  if (!context) throw new LootError("Sign in with Discord to view your boxes.",401);
  const manage=canManageWhiterunStorage(context);
  const mine=await db.select({id:lootBoxes.id,eventId:lootBoxes.eventId,eventName:lootEvents.name,contents:lootBoxes.contents,openedAt:lootBoxes.openedAt,fulfilledAt:lootBoxes.fulfilledAt,assignedAt:lootBoxes.assignedAt})
    .from(lootBoxes).innerJoin(lootEvents,eq(lootBoxes.eventId,lootEvents.id)).where(eq(lootBoxes.userId,context.userId)).orderBy(desc(lootBoxes.assignedAt));
  const boxes=mine.map(({contents,...box})=>({...box,tier:contents.tier,...(box.openedAt?{contents}: {})}));
  if(!manage) return {manage:false as const,boxes};
  const [storages,events,purchases,accounts,assignments]=await Promise.all([
    db.select().from(chestStorage),db.select().from(lootEvents).orderBy(desc(lootEvents.createdAt)),
    db.select().from(lootPurchases),
    db.select({id:users.id,name:users.name,displayName:users.displayName,discordId:users.discordId}).from(users).where(isNull(users.quarantinedAt)),
    db.select().from(lootBoxes),
  ]);
  const storage=await Promise.all(storages.map(async(row)=>({...row,items:await enrich({kind:row.kind as StorageKind,containerId:"",capturedAt:row.capturedAt.toISOString(),session:"",items:row.items})})));
  const eventStorage=storages.find((row)=>row.kind==="event");
  const available=eventStorage?await db.transaction((tx)=>availableEventItems(tx,eventStorage)):[];
  const bundles=(await db.select().from(lootLeadingBundles).orderBy(lootLeadingBundles.name)).map(bundle=>({...bundle,name:withoutQuality(bundle.name),lines:resolveBundleLines(bundle.lines,available)}));
  return {manage:true as const,boxes,storage,available,events,purchases,users:accounts,assignments,bundles,defaults:defaultSettings};
}
export type LootDashboard=Awaited<ReturnType<typeof getLootDashboard>>;
export async function executeLootCommand(context:AccessContext|null, command:LootCommand) {
  if(!context) throw new LootError("Sign in with Discord first.",401);
  if(command.action==="open") return db.transaction(async(tx)=>{
    await lock(tx);
    const [box]=await tx.select().from(lootBoxes).where(and(eq(lootBoxes.id,command.boxId),eq(lootBoxes.userId,context.userId))).limit(1);
    if(!box) throw new LootError("Box not found.",404);
    if(!box.openedAt) {
      await tx.update(lootBoxes).set({openedAt:new Date()}).where(eq(lootBoxes.id,box.id));
      await audit(tx,context,"opened",box.id,{eventId:box.eventId});
    }
    return {id:box.id,contents:box.contents};
  });
  owner(context);
  if(command.action==="bundle"||command.action==="deleteBundle")return db.transaction(async tx=>{
    await lock(tx);
    if(command.action==="deleteBundle"){
      await tx.delete(lootLeadingBundles).where(eq(lootLeadingBundles.id,command.id));
      await audit(tx,context,"leading_bundle_deleted",command.id,{});
    }else{
      const storage=await tx.select().from(chestStorage).where(eq(chestStorage.kind,"event"));
      const items=storage[0]?await enrich({kind:"event",containerId:"",capturedAt:storage[0].capturedAt.toISOString(),session:"",items:storage[0].items}):[];
      if(new Set(command.lines.map(line=>line.key)).size!==command.lines.length)throw new LootError("Combine duplicate items into a single quantity.",400);
      const selected=command.lines.map(line=>({line,item:items.find(item=>item.key===line.key)}));
      if(command.enabled&&selected.some(row=>!row.item||row.item.excluded))throw new LootError("Choose non-excluded items from current event storage.",400);
      const books=selected.filter(row=>row.item?.category==="Book");
      if(books.length===1)throw new LootError("A book cannot lead alone. Add the complete set.",400);
      if(books.some(row=>/^A Dance in Fire, v\d+$/i.test(row.item!.name))&&Array.from({length:7},(_,k)=>`A Dance in Fire, v${k+1}`).some(name=>!books.some(row=>row.item!.name.toLowerCase()===name.toLowerCase())))throw new LootError("A Dance in Fire requires all seven volumes.",400);
      const id=command.id??randomUUID();
      if(command.id&&!(await tx.select({id:lootLeadingBundles.id}).from(lootLeadingBundles).where(eq(lootLeadingBundles.id,id))).length)throw new LootError("Leading reward not found.",404);
      const values={name:command.name||bundleLabel(selected.map(({line,item})=>({name:item?.name??"Unavailable item",quantity:line.quantity}))),lines:command.lines,enabled:command.enabled,updatedBy:context.userId,updatedAt:new Date()};
      await tx.insert(lootLeadingBundles).values({id,...values}).onConflictDoUpdate({target:lootLeadingBundles.id,set:values});
      await audit(tx,context,"leading_bundle_saved",id,values);
    }
    await tx.update(lootEvents).set({plan:null,updatedAt:new Date()}).where(eq(lootEvents.status,"draft"));
    return {saved:true};
  });
  if(command.action==="import") {
    let snapshot:StorageSnapshot;
    try { snapshot=importStorageCsv(command.csv,command.kind); } catch(error) { throw new LootError(error instanceof Error?error.message:"Invalid storage CSV.",400); }
    const fingerprint=createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    return db.transaction(async(tx)=>{
      await lock(tx);
      const [existing]=await tx.select().from(chestStorage).where(eq(chestStorage.kind,command.kind)).limit(1);
      if(existing?.fingerprint===fingerprint) return {unchanged:true,snapshotId:existing.snapshotId};
      if(existing&&new Date(snapshot.capturedAt)<existing.capturedAt) throw new LootError("This capture is older than the current storage snapshot.");
      const snapshotId=randomUUID();
      const values={snapshotId,fingerprint,capturedAt:new Date(snapshot.capturedAt),importedAt:new Date(),importedBy:context.userId,items:snapshot.items};
      await tx.insert(chestStorage).values({kind:command.kind,...values}).onConflictDoUpdate({target:chestStorage.kind,set:values});
      await audit(tx,context,"storage_imported",snapshotId,{kind:command.kind,rows:snapshot.items.length,capturedAt:snapshot.capturedAt});
      return {snapshotId};
    });
  }
  if(command.action==="price"||command.action==="exclude") return db.transaction(async(tx)=>{
    await lock(tx);
    const snapshots=await tx.select().from(chestStorage);
    const all=await Promise.all(snapshots.map(row=>enrich({kind:row.kind as StorageKind,containerId:"",capturedAt:row.capturedAt.toISOString(),session:"",items:row.items})));
    const item=all.flat().find(row=>row.key===command.key||row.sourceKeys?.includes(command.key));
    if(!item) throw new LootError("Item not in current storage.",404);
    if(command.action==="exclude"&&!command.excluded&&!item.reviewed) throw new LootError("Identify this item in Event storage before returning it to boxes.");
    if(command.action==="price"&&/^Amulet of /i.test(item.name)&&command.unitValue!==150) throw new LootError("Amulets of the Divines are valued at 150g.");
    const price=command.action==="price"?command.unitValue:item.unitValue;
    const values={unitValue:price==null?null:price.toFixed(2),category:command.action==="price"?command.category:item.category,excluded:command.excluded,reviewed:command.action==="price"?command.reviewed:item.reviewed,leading:command.action==="price"?command.leading??item.leading:item.leading,updatedBy:context.userId,updatedAt:new Date()};
    await tx.insert(chestPriceOverrides).values({itemKey:item.key,...values}).onConflictDoUpdate({target:chestPriceOverrides.itemKey,set:values});
    // Existing draft plans have stale values; force a deliberate repack.
    await tx.update(lootEvents).set({plan:null,updatedAt:new Date()}).where(eq(lootEvents.status,"draft"));
    await audit(tx,context,command.action==="exclude"?"exclusion_updated":"price_updated",randomUUID(),{key:command.key,...values});
    return {saved:true};
  });
  return db.transaction(async(tx)=>{
    await lock(tx);
    if(command.action==="deleteEvent") {
      const [event]=await tx.select().from(lootEvents).where(eq(lootEvents.id,command.eventId));
      if(!event)throw new LootError("Event not found.",404);
      const boxes=await tx.select({id:lootBoxes.id}).from(lootBoxes).where(eq(lootBoxes.eventId,event.id));
      if(event.status!=="draft"||boxes.length)throw new LootError("Distributed events cannot be deleted. Their boxes and handovers must be retained.");
      await tx.delete(lootPurchases).where(eq(lootPurchases.eventId,event.id));
      await tx.delete(lootEvents).where(eq(lootEvents.id,event.id));
      await audit(tx,context,"event_deleted",event.id,{name:event.name,purchasesRemoved:true});
      return {deleted:true};
    }
    if(command.action==="plan"||command.action==="preview") {
      const [storage]=await tx.select().from(chestStorage).where(eq(chestStorage.kind,"event")).limit(1);
      if(!storage) throw new LootError("Import EVENT STORAGE first.");
      const items=await availableEventItems(tx,storage);
      let plan;
      const bundles=(await tx.select().from(lootLeadingBundles).where(eq(lootLeadingBundles.enabled,true))).map(bundle=>({...bundle,name:withoutQuality(bundle.name),lines:resolveBundleLines(bundle.lines,items)}));
      try { plan=planLoot(items,{...command.settings,leaderBundles:bundles}); } catch(error) { throw new LootError(error instanceof Error?error.message:"Invalid plan.",400); }
      if(command.action==="preview") return {plan};
      if(plan.blocked) throw new LootError(plan.warnings.join(" ")||"Check the box requirements before generating.");
      if(command.eventId) {
        const [event]=await tx.select().from(lootEvents).where(eq(lootEvents.id,command.eventId));
        if(!event||event.status!=="draft") throw new LootError("Only draft events can be repacked.");
        await tx.update(lootEvents).set({name:command.name,settings:command.settings,snapshotId:storage.snapshotId,plan,updatedAt:new Date()}).where(eq(lootEvents.id,event.id));
        await audit(tx,context,"repacked",event.id,{boxes:plan.boxes.length});
        return {eventId:event.id,plan};
      }
      const [event]=await tx.insert(lootEvents).values({name:command.name,settings:command.settings,snapshotId:storage.snapshotId,plan,createdBy:context.userId}).returning({id:lootEvents.id});
      await audit(tx,context,"planned",event.id,{boxes:plan.boxes.length});
      return {eventId:event.id,plan};
    }
    if(command.action==="purchase") {
      const [event]=await tx.select().from(lootEvents).where(eq(lootEvents.id,command.eventId));
      const [recipient]=await tx.select({id:users.id}).from(users).where(and(eq(users.id,command.userId),isNull(users.quarantinedAt)));
      if(!event||!recipient) throw new LootError("Event or signed-in customer not found.",404);
      const assigned=(await tx.select().from(lootBoxes).where(and(eq(lootBoxes.eventId,event.id),eq(lootBoxes.userId,command.userId)))).filter(box=>box.contents.tier===command.tier);
      const locked=assigned.filter(box=>box.openedAt||box.fulfilledAt);
      if(locked.length>command.quantity) throw new LootError(`At least ${locked.length} boxes have been opened or handed over and cannot be removed.`);
      const release=assigned.filter(box=>!box.openedAt&&!box.fulfilledAt).slice(0,Math.max(0,assigned.length-command.quantity));
      for(const box of release)await tx.update(lootBoxes).set({userId:null,assignedAt:null}).where(eq(lootBoxes.id,box.id));
      await tx.insert(lootPurchases).values({eventId:event.id,userId:command.userId,tier:command.tier,quantity:Math.max(1,command.quantity),createdBy:context.userId}).onConflictDoUpdate({target:[lootPurchases.eventId,lootPurchases.userId,lootPurchases.tier],set:{quantity:Math.max(1,command.quantity)}});
      if(command.quantity===0) await tx.delete(lootPurchases).where(and(eq(lootPurchases.eventId,event.id),eq(lootPurchases.userId,command.userId),eq(lootPurchases.tier,command.tier)));
      await audit(tx,context,"purchases_updated",event.id,{userId:command.userId,tier:command.tier,quantity:command.quantity});
      return {saved:true};
    }
    if(command.action==="distribute") {
      const [event]=await tx.select().from(lootEvents).where(eq(lootEvents.id,command.eventId));
      if(!event?.plan||event.plan.blocked) throw new LootError("Generate a valid plan first.");
      const purchases=await tx.select().from(lootPurchases).where(eq(lootPurchases.eventId,event.id));
      if(!purchases.length) throw new LootError("Assign purchases to customers first.");
      if(event.status==="draft") {
        const [storage]=await tx.select().from(chestStorage).where(eq(chestStorage.kind,"event"));
        if(!storage||storage.snapshotId!==event.snapshotId) throw new LootError("Storage changed. Repack before distribution.");
        const available=await availableEventItems(tx,storage);
        const quantities=new Map(available.map((row)=>[row.key,row.quantity]));
        for(const box of event.plan.boxes) for(const line of box.lines) {
          const key=resolveQualityKey(line.key,available,line.name);
          const left=(quantities.get(key)??0)-line.quantity;
          if(left<0) throw new LootError("Other boxes reserved this stock. Repack first.");
          quantities.set(key,left);
        }
        await tx.insert(lootBoxes).values(event.plan.boxes.map((box)=>({eventId:event.id,boxNumber:box.id,contents:box})));
        await tx.update(lootEvents).set({status:"distributed",updatedAt:new Date()}).where(eq(lootEvents.id,event.id));
      }
      const boxes=await tx.select().from(lootBoxes).where(eq(lootBoxes.eventId,event.id));
      let distributed=0;
      for(const purchase of purchases) {
        const already=boxes.filter((box)=>box.userId===purchase.userId&&box.contents.tier===purchase.tier).length;
        const needed=purchase.quantity-already;
        const pool=boxes.filter((box)=>!box.userId&&box.contents.tier===purchase.tier);
        if(pool.length<needed) throw new LootError(`Not enough ${purchase.tier} boxes for the assigned purchases.`);
        for(let index=0;index<needed;index++) {
          const [chosen]=pool.splice(randomInt(pool.length),1);
          chosen.userId=purchase.userId;
          await tx.update(lootBoxes).set({userId:purchase.userId,assignedAt:new Date()}).where(eq(lootBoxes.id,chosen.id));
          distributed++;
        }
      }
      await audit(tx,context,"distributed",event.id,{distributed});
      return {distributed};
    }
    if(command.action==="fulfill") {
      const [box]=await tx.select().from(lootBoxes).where(and(eq(lootBoxes.id,command.boxId),isNotNull(lootBoxes.userId)));
      if(!box) throw new LootError("Assigned box not found.",404);
      if(!box.openedAt) throw new LootError("The customer must open this box before handover.");
      if(!box.fulfilledAt) {
        await tx.update(lootBoxes).set({fulfilledAt:new Date(),fulfilledBy:context.userId}).where(eq(lootBoxes.id,box.id));
        await audit(tx,context,"fulfilled",box.id,{recipient:box.userId,lines:box.contents.lines});
      }
      return {fulfilled:true};
    }
    throw new LootError("Unsupported operation.",400);
  });
}
