/**
 * Destructive test fixture setup is confined to a separately-created *_loot_test
 * database. Never run this against the live ledger.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, database } from "../src/db/runtime";
import { baseCostRules, catalogItems, chestStorage, lootBoxes, lootEvents, sessions, users } from "../src/db/schema";
import { executeLootCommand, getLootDashboard } from "../src/lib/loot/service";
import { importStorageCsv } from "../src/lib/loot/storage-import";
import type { AccessContext } from "../src/lib/authorization";
const url=new URL(process.env.DATABASE_URL??"");
assert.match(url.pathname,/_loot_test$/, "Use an isolated *_loot_test database.");
const settings={count:100,margin:.2,general:120,premium:150,exclusive:200};
async function main() {
  await db.execute(sql`truncate loot_boxes, loot_purchases, loot_events, loot_leading_bundles, chest_price_overrides, chest_storage, sessions`);
  const runId=randomUUID();
  const actor=async(discordId:string,name:string):Promise<AccessContext>=>{
    const [user]=await db.insert(users).values({discordId,name,displayName:name}).onConflictDoUpdate({target:users.discordId,set:{name}}).returning();
    return {userId:user.id,discordId,globalRole:"user",memberships:[]};
  };
  const owner=await actor("314050267341520899","Whiterun owner");
  const admin=await actor("145997830052380674","SkyStore administrator");
  const customer=await actor("100000000000000001","Test customer");
  const outsider=await actor("100000000000000002","Other customer");
  for(const [token,person] of [["loot-test-owner-session",owner],["loot-test-customer-session",customer],["loot-test-outsider-session",outsider]] as const) {
    await db.insert(sessions).values({sessionToken:token,userId:person.userId,expires:new Date(Date.now()+3_600_000)}).onConflictDoUpdate({target:sessions.sessionToken,set:{expires:new Date(Date.now()+3_600_000)}});
  }
  const csv=await readFile(process.env.LOOT_CAPTURE_CSV??"/captures/inventory.csv","utf8");
  await executeLootCommand(owner,{action:"import",kind:"store",csv});
  await assert.rejects(()=>executeLootCommand(customer,{action:"import",kind:"event",csv}),/Only/);
  await executeLootCommand(owner,{action:"import",kind:"event",csv});
  const [before]=await db.select().from(chestStorage).where(eq(chestStorage.kind,"event"));
  const repeat=await executeLootCommand(owner,{action:"import",kind:"event",csv});
  assert.equal("unchanged" in repeat&&repeat.unchanged,true);
  const [after]=await db.select().from(chestStorage).where(eq(chestStorage.kind,"event"));
  assert.equal(after.snapshotId,before.snapshotId);
  assert.equal(after.items.reduce((sum,row)=>sum+row.quantity,0),1379);
  const snapshot=importStorageCsv(csv,"event");
  // Reference lookup preserves form identity and refuses provisional estimates.
  const referenceId="83dba151-057b-457c-aa1f-c71bc4de2240";
  await db.insert(catalogItems).values({id:referenceId,stableKey:"loot-test.esp|123456",plugin:"loot-test.esp",localFormId:"123456",displayName:"Reference Ore",recordType:"MiscItem",category:"Ore"}).onConflictDoNothing();
  await db.delete(baseCostRules).where(eq(baseCostRules.itemId,referenceId));
  await db.insert(baseCostRules).values([
    {itemId:referenceId,totalSeptims:2,quantity:1,effectiveFrom:new Date("2026-10-01"),sourceLabel:"Confirmed test reference"},
    {itemId:referenceId,totalSeptims:999,quantity:1,effectiveFrom:new Date("2026-10-02"),sourceLabel:"Unconfirmed estimate"},
  ]);
  const storeCsv="container_id,name,count,form_id,source_plugin,captured_utc,session,custom_name,temper_health\n000C83E9,Reference Ore,3,0F123456,loot-test.esp,2026-10-15T00:00:00Z,test,,\n";
  await executeLootCommand(owner,{action:"import",kind:"store",csv:storeCsv});
  const referenceDashboard=await getLootDashboard(owner);assert.ok(referenceDashboard.manage);
  if(referenceDashboard.manage) {
    const ore=referenceDashboard.storage.find((row)=>row.kind==="store")!.items[0];
    assert.equal(ore.unitValue,2);
    await executeLootCommand(owner,{action:"price",key:ore.key,unitValue:7,category:"Material",excluded:false,reviewed:true,leading:true});
    await executeLootCommand(owner,{action:"import",kind:"store",csv:storeCsv});
    const overridden=await getLootDashboard(owner);
    assert.ok(overridden.manage&&overridden.storage.find((row)=>row.kind==="store")!.items[0].unitValue===7);
    assert.ok(overridden.manage&&overridden.storage.find((row)=>row.kind==="store")!.items[0].leading===true);
    await executeLootCommand(owner,{action:"exclude",key:ore.key,excluded:true});
    const reserved=await getLootDashboard(owner);assert.ok(reserved.manage);
    if(reserved.manage){const item=reserved.storage.find(row=>row.kind==="store")!.items[0];assert.equal(item.excluded,true);assert.equal(item.leading,true);assert.equal(item.unitValue,7);assert.equal(item.category,"Material");}
    await executeLootCommand(owner,{action:"exclude",key:ore.key,excluded:false});
    const restored=await getLootDashboard(owner);assert.ok(restored.manage&&restored.storage.find(row=>row.kind==="store")!.items[0].excluded===false);
  }
  assert.ok("plan" in await executeLootCommand(owner,{action:"preview",settings}));
  let initial=await getLootDashboard(owner);assert.equal(initial.manage,true);
  if(!initial.manage)throw new Error("Owner denied.");
  // The isolated fixture has no full game catalog. Explicitly verify its known,
  // priced sample entries rather than pretending they were game-file matches.
  for(const row of initial.available.filter(row=>row.excluded&&row.unitValue!=null&&row.category!=="Review")){
    await executeLootCommand(owner,{action:"price",key:row.key,unitValue:row.unitValue,category:row.category as "Armor",excluded:false,reviewed:true});
  }
  initial=await getLootDashboard(owner);if(!initial.manage)throw new Error("Owner denied.");
  const bundleLines=initial.available.filter(row=>row.category!=="Book"&&row.category!=="Review"&&!row.excluded).slice(0,2).map(row=>({key:row.key,quantity:1}));
  const bundleCommand={action:"bundle" as const,enabled:false,lines:bundleLines};
  await assert.rejects(()=>executeLootCommand(customer,bundleCommand),/Only/);
  await executeLootCommand(owner,bundleCommand);
  const withBundles=await getLootDashboard(owner);
  assert.ok(withBundles.manage&&withBundles.bundles.some(row=>row.name.length>0));
  const hiddenBundles=await getLootDashboard(customer);assert.equal("bundles" in hiddenBundles,false);
  if(withBundles.manage)await executeLootCommand(owner,{action:"deleteBundle",id:withBundles.bundles[0].id});
  for(const item of initial.available.filter((row)=>row.category==="Review")) {
    await executeLootCommand(owner,{action:"price",key:item.key,category:"Review",unitValue:item.unitValue,excluded:true,reviewed:false});
  }
  const plan=await executeLootCommand(owner,{action:"plan",name:`Acceptance ${runId}`,settings});
  assert.ok("eventId" in plan);if(!("eventId" in plan))throw new Error("No event.");
  assert.equal(plan.plan.boxes.length,100);assert.equal(plan.plan.profit,4495);
  const disposable=await executeLootCommand(owner,{action:"plan",name:"Delete me",settings});
  assert.ok("eventId" in disposable);if(!("eventId" in disposable))throw Error("No draft");
  await executeLootCommand(owner,{action:"purchase",eventId:disposable.eventId,userId:customer.userId,tier:"General",quantity:2});
  await assert.rejects(()=>executeLootCommand(customer,{action:"deleteEvent",eventId:disposable.eventId}),/Only/);
  await executeLootCommand(owner,{action:"deleteEvent",eventId:disposable.eventId});
  assert.equal((await db.select().from(lootEvents).where(eq(lootEvents.id,disposable.eventId))).length,0);
  const repacked=await executeLootCommand(owner,{action:"plan",eventId:plan.eventId,name:"Updated acceptance event",settings});
  assert.ok("eventId" in repacked&&repacked.eventId===plan.eventId);
  const higher=await executeLootCommand(owner,{action:"preview",settings:{...settings,margin:.3}});
  assert.ok("plan" in higher);
  if("plan" in higher){assert.equal(higher.plan.boxes.length,115);assert.equal(higher.plan.profit,7675);}
  if(process.env.LOOT_FIXTURE_MODE==="planning"){console.log("Planning fixture ready in isolated database.");return;}
  await executeLootCommand(owner,{action:"purchase",eventId:plan.eventId,userId:customer.userId,tier:"General",quantity:999});
  await assert.rejects(()=>executeLootCommand(owner,{action:"distribute",eventId:plan.eventId}),/Not enough/);
  assert.equal((await db.select().from(lootBoxes)).length,0);
  assert.equal((await db.select().from(lootEvents).where(eq(lootEvents.id,plan.eventId)))[0].status,"draft");
  await executeLootCommand(owner,{action:"purchase",eventId:plan.eventId,userId:customer.userId,tier:"General",quantity:2});
  await executeLootCommand(admin,{action:"purchase",eventId:plan.eventId,userId:customer.userId,tier:"Premium",quantity:1});
  await Promise.all([executeLootCommand(owner,{action:"distribute",eventId:plan.eventId}),executeLootCommand(admin,{action:"distribute",eventId:plan.eventId})]);
  let mine=await getLootDashboard(customer);
  assert.equal(mine.manage,false);assert.equal(mine.boxes.length,3);
  assert.equal("storage" in mine,false);assert.equal("users" in mine,false);
  assert.ok(mine.boxes.every((box)=>!("contents" in box)));
  await assert.rejects(()=>executeLootCommand(owner,{action:"deleteEvent",eventId:plan.eventId}),/Distributed/);
  await executeLootCommand(owner,{action:"purchase",eventId:plan.eventId,userId:customer.userId,tier:"General",quantity:1});
  assert.equal((await getLootDashboard(customer)).boxes.length,2);
  await executeLootCommand(owner,{action:"purchase",eventId:plan.eventId,userId:customer.userId,tier:"General",quantity:0});
  assert.equal((await getLootDashboard(customer)).boxes.length,1);
  await executeLootCommand(owner,{action:"purchase",eventId:plan.eventId,userId:customer.userId,tier:"General",quantity:2});
  await executeLootCommand(owner,{action:"distribute",eventId:plan.eventId});
  mine=await getLootDashboard(customer);
  const other=await getLootDashboard(outsider);assert.equal(other.boxes.length,0);
  await assert.rejects(()=>executeLootCommand(outsider,{action:"open",boxId:mine.boxes[0].id}),/not found/);
  const opened=await executeLootCommand(customer,{action:"open",boxId:mine.boxes[0].id});
  const reopened=await executeLootCommand(customer,{action:"open",boxId:mine.boxes[0].id});
  const openedTier=(await db.select().from(lootBoxes).where(eq(lootBoxes.id,mine.boxes[0].id)))[0].contents.tier;
  await assert.rejects(()=>executeLootCommand(owner,{action:"purchase",eventId:plan.eventId,userId:customer.userId,tier:openedTier,quantity:0}),/opened or handed over/);
  assert.deepEqual(opened,reopened);
  await assert.rejects(()=>executeLootCommand(customer,{action:"fulfill",boxId:mine.boxes[0].id}),/Only/);
  await executeLootCommand(owner,{action:"fulfill",boxId:mine.boxes[0].id});
  const [fulfilled]=await db.select().from(lootBoxes).where(eq(lootBoxes.id,mine.boxes[0].id));assert.ok(fulfilled.fulfilledAt);
  const dashboard=await getLootDashboard(owner);assert.ok(dashboard.manage);
  if(dashboard.manage)assert.equal(dashboard.available.reduce((sum,row)=>sum+row.quantity,0),0);
  await executeLootCommand(owner,{action:"import",kind:"event",csv});
  const reimported=await getLootDashboard(owner);
  assert.ok(reimported.manage&&reimported.available.reduce((sum,row)=>sum+row.quantity,0)===0);
  assert.equal(snapshot.items.length,102);
  console.log("PASS: actual CSV, duplicate imports, review gates, confirmed prices, 100-box conservation, concurrent distribution, customer privacy, idempotent opening, and owner-only handover.");
}
main().catch((error)=>{console.error(error);process.exitCode=1;}).finally(()=>database.client.end());
