/** Private, one-time state transfer. Never commit or upload the generated SQL. */
import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {dirname} from "node:path";
import {database} from "../src/db/runtime";

const tables=["chest_storage","chest_price_overrides","loot_leading_bundles","loot_events","loot_purchases","loot_boxes"] as const;
const refs:Record<string,string[]>={chest_storage:["imported_by"],chest_price_overrides:["updated_by"],loot_leading_bundles:["updated_by"],loot_events:["created_by"],loot_purchases:["created_by","user_id"],loot_boxes:["user_id","fulfilled_by"]};
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const json=(value:unknown)=>quote(JSON.stringify(value))+"::jsonb";
async function main(){
 const output=process.argv[2];if(!output||!output.startsWith("output/"))throw Error("Supply a private output/...sql path.");
 const state=await database.client.begin("isolation level repeatable read read only",async sql=>{
  const rows:Record<string,Record<string,unknown>[]>= {};
  for(const table of tables)rows[table]=await sql.unsafe(`select * from ${table}`);
  const ids=new Set<string>();for(const table of tables)for(const row of rows[table])for(const field of refs[table])if(row[field])ids.add(String(row[field]));
  const people=await sql.unsafe("select id, discord_id, name, display_name, global_role from users");
  const users=people.filter(row=>ids.has(String(row.id)));
  if(users.some(row=>!row.discord_id))throw Error("Every referenced person must have a Discord identity.");
  // Exact source records restored from offline plugin exports, not the full catalog.
  const catalog=await sql.unsafe("select * from catalog_items where metadata ? 'sourceCatalogExport'");
  return {rows,users,catalog};
 });
 const hash=createHash("sha256").update(JSON.stringify(state)).digest("hex");
 const marker=[hash.slice(0,8),hash.slice(8,12),hash.slice(12,16),hash.slice(16,20),hash.slice(20,32)].join("-");
 const statements=["\\set ON_ERROR_STOP on","BEGIN;","SELECT pg_advisory_xact_lock(193733, 1);",`DO $transfer$ BEGIN IF EXISTS(select 1 from audit_events where action='loot.state_imported' and entity_id=${quote(marker)}) THEN RAISE NOTICE 'This snapshot was already imported; nothing changed.'; RETURN; END IF;`,"CREATE TEMP TABLE loot_user_map(source_id uuid PRIMARY KEY, target_id uuid NOT NULL) ON COMMIT DROP;"];
 for(const user of state.users){
  statements.push(`INSERT INTO users(id,discord_id,name,display_name,global_role) VALUES(${quote(String(user.id))},${quote(String(user.discord_id))},${user.name==null?"NULL":quote(String(user.name))},${user.display_name==null?"NULL":quote(String(user.display_name))},${quote(String(user.global_role))}) ON CONFLICT(discord_id) DO NOTHING;`, `INSERT INTO loot_user_map SELECT ${quote(String(user.id))}::uuid,id FROM users WHERE discord_id=${quote(String(user.discord_id))};`, `INSERT INTO accounts(user_id,type,provider,provider_account_id) SELECT target_id,'oauth','discord',${quote(String(user.discord_id))} FROM loot_user_map WHERE source_id=${quote(String(user.id))}::uuid ON CONFLICT DO NOTHING;`);
 }
 for(const table of ["loot_events","loot_leading_bundles","loot_purchases","loot_boxes"]){
  const ids=state.rows[table].map(row=>String(row.id));
  if(ids.length)statements.push(`IF EXISTS(select 1 from ${table} where id in (${ids.map(quote).join(",")})) THEN RAISE EXCEPTION 'Existing ${table} IDs conflict. Import stopped without changes; do not overwrite live events.'; END IF;`);
 }
 for(const row of state.rows.chest_storage)statements.push(`IF EXISTS(select 1 from chest_storage where kind=${quote(String(row.kind))} and captured_at>${quote(String(row.captured_at))}::timestamptz) THEN RAISE EXCEPTION 'Live chest capture is newer. Reconcile stock before importing local plans.'; END IF;`);
 for(const row of state.catalog)statements.push(`INSERT INTO catalog_items SELECT * FROM jsonb_populate_record(NULL::catalog_items,${json({...row,catalog_version_id:null})}) ON CONFLICT DO NOTHING;`);
 for(const table of tables){
  for(const row of state.rows[table]){
   let payload=json(row);
   for(const field of refs[table])if(row[field])payload=`jsonb_set(${payload},'{${field}}',to_jsonb((SELECT target_id FROM loot_user_map WHERE source_id=${quote(String(row[field]))}::uuid)))`;
   let conflict="";
   if(table==="chest_storage")conflict=" ON CONFLICT(kind) DO UPDATE SET snapshot_id=excluded.snapshot_id,fingerprint=excluded.fingerprint,captured_at=excluded.captured_at,imported_at=excluded.imported_at,imported_by=excluded.imported_by,items=excluded.items";
   if(table==="chest_price_overrides")conflict=' ON CONFLICT(item_key) DO UPDATE SET unit_value=excluded.unit_value,category=excluded.category,excluded=excluded.excluded,"leading"=excluded."leading",reviewed=excluded.reviewed,updated_by=excluded.updated_by,updated_at=excluded.updated_at WHERE chest_price_overrides.updated_at<excluded.updated_at';
   statements.push(`INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table},${payload})${conflict};`);
  }
 }
 statements.push(`INSERT INTO audit_events(action,entity_type,entity_id,after) VALUES('loot.state_imported','loot_snapshot',${quote(marker)},${json({sha256:hash,exportedAt:new Date().toISOString(),counts:Object.fromEntries(tables.map(t=>[t,state.rows[t].length]))})});`,"END $transfer$;","COMMIT;");
 await mkdir(dirname(output),{recursive:true});
 await writeFile(output,"-- PRIVATE SkyStore event state. Contains customer identities; do not publish.\n"+statements.join("\n")+"\n",{mode:0o600});
 console.log(JSON.stringify({output,sha256:hash,counts:Object.fromEntries(tables.map(t=>[t,state.rows[t].length])),catalogAdditions:state.catalog.length,plannedBoxes:state.rows.loot_events.reduce((n,row)=>n+((row.plan as {boxes?:unknown[]}|null)?.boxes?.length??0),0)}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>database.client.end());
