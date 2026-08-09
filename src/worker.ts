import { createHash, randomUUID } from "node:crypto";
import { database } from "@/db/runtime";
import { estimateMarket, publicSnapshotCutoff, type MarketSignal } from "@/lib/market";

type Job = { id: string; kind: string; payload: unknown; attempts: number; max_attempts: number };
type EvidenceRow = { item_id: string; display_name: string; store_id: string | null; total_septims: number; quantity: number; occurrence_at: Date; kind: "receipt" | "direct_quote" };
type OfficialRow = { item_id: string; display_name: string; side: "customer_pays"; minimum_septims: number; maximum_septims: number; quantity: number; maximum_quantity: number };
type HotItemRow = { item_id: string; display_name: string; units_sold: number; trade_count: number; store_count: number };
type FavoriteRow = { item_id: string; display_name: string; units_traded: number; trade_count: number; active_months: number; store_count: number };

const workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
let stopping = false;

async function claimJob(): Promise<Job | null> {
  const rows = await database.client<Job[]>`
    with candidate as (
      select id from jobs
      where status = 'queued' and run_after <= now()
      order by run_after, created_at
      for update skip locked
      limit 1
    )
    update jobs set status = 'running', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
    where id in (select id from candidate)
    returning id, kind, payload, attempts, max_attempts
  `;
  return rows[0] ?? null;
}

async function createPublicSnapshot(now = new Date()) {
  const cutoff = publicSnapshotCutoff(now);
  const cutoffIso = cutoff.toISOString();
  const evidence = await database.client<EvidenceRow[]>`
    select rl.item_id, i.display_name, r.store_id, rl.total_septims, rl.quantity, r.occurrence_at, 'receipt'::text as kind
    from receipt_lines rl
    join receipts r on r.id = rl.receipt_id
    join users u on u.id = r.submitted_by
    join catalog_items i on i.id = rl.item_id
    where r.status = 'approved' and r.direction = 'store_sale'
      and r.occurrence_at <= ${cutoffIso}::timestamptz and u.quarantined_at is null
    union all
    select p.item_id, i.display_name, null::uuid as store_id, p.total_septims, p.quantity, p.created_at as occurrence_at, 'direct_quote'::text as kind
    from public_market_reports p
    left join users u on u.id = p.submitted_by
    join catalog_items i on i.id = p.item_id
    where p.status = 'approved' and p.location_type = 'store_sale'
      and p.created_at <= ${cutoffIso}::timestamptz
      and p.quarantined_at is null and u.quarantined_at is null
  `;
  const official = await database.client<OfficialRow[]>`
    select p.item_id, i.display_name, p.side, p.minimum_septims, p.maximum_septims, p.quantity, p.maximum_quantity
    from official_price_rules p join catalog_items i on i.id = p.item_id
    where p.side = 'customer_pays' and p.effective_from <= now() and (p.effective_to is null or p.effective_to > now()) and i.status = 'active'
    order by i.display_name, p.side
  `;
  const hotItems = await database.client<HotItemRow[]>`
    select rl.item_id, i.display_name, sum(rl.quantity)::int as units_sold,
      count(distinct r.id)::int as trade_count, count(distinct r.store_id)::int as store_count
    from receipt_lines rl
    join receipts r on r.id = rl.receipt_id
    join users u on u.id = r.submitted_by
    join catalog_items i on i.id = rl.item_id
    where r.status = 'approved' and r.direction = 'store_sale'
      and r.occurrence_at <= ${cutoffIso}::timestamptz
      and r.occurrence_at > ${cutoffIso}::timestamptz - interval '30 days'
      and u.quarantined_at is null
    group by rl.item_id, i.display_name
    having count(distinct r.store_id) >= 3
    order by units_sold desc, trade_count desc, i.display_name
    limit 5
  `;
  const allTimeFavorites = await database.client<FavoriteRow[]>`
    select rl.item_id, i.display_name, sum(rl.quantity)::int as units_traded,
      count(distinct r.id)::int as trade_count,
      count(distinct date_trunc('month', r.occurrence_at))::int as active_months,
      count(distinct r.store_id)::int as store_count
    from receipt_lines rl
    join receipts r on r.id = rl.receipt_id
    join users u on u.id = r.submitted_by
    join catalog_items i on i.id = rl.item_id
    where r.status = 'approved' and r.direction = 'store_sale' and r.occurrence_at <= ${cutoffIso}::timestamptz
      and u.quarantined_at is null
    group by rl.item_id, i.display_name
    having count(distinct r.store_id) >= 3
    order by active_months desc, trade_count desc, units_traded desc, i.display_name
    limit 10
  `;
  const itemNames = new Map([...official, ...evidence].map((row) => [row.item_id, row.display_name]));
  const grouped = new Map<string, MarketSignal[]>();
  for (const row of evidence) {
    const key = row.item_id;
    const signals = grouped.get(key) ?? [];
    signals.push({ itemId: row.item_id, side: "customer_pays", storeId: row.store_id ?? undefined, totalSeptims: Number(row.total_septims), quantity: Number(row.quantity), occurrenceAt: new Date(row.occurrence_at), kind: row.kind, approved: true });
    grouped.set(key, signals);
  }
  const estimates = [...grouped.entries()].map(([key, signals]) => {
    const itemId = key;
    return { itemId, name: itemNames.get(itemId) ?? "Catalog item", side: "customer_pays" as const, ...estimateMarket(signals, itemId, "customer_pays", now, cutoff) };
  }).filter((estimate) => estimate.anonymized);
  const payload = {
    policy: { delayDays: 7, minimumStores: 3, windowDays: 90, recencyHalfLifeDays: 30 },
    official: official.map((row) => ({ itemId: row.item_id, name: row.display_name, side: row.side, septims: [row.minimum_septims, row.maximum_septims], quantity: [row.quantity, row.maximum_quantity] })),
    estimates,
    hotItems: hotItems.map((row) => ({ itemId: row.item_id, name: row.display_name, unitsSold: Number(row.units_sold), tradeCount: Number(row.trade_count), storeCount: Number(row.store_count) })),
    allTimeFavorites: allTimeFavorites.map((row) => ({ itemId: row.item_id, name: row.display_name, unitsTraded: Number(row.units_traded), tradeCount: Number(row.trade_count), activeMonths: Number(row.active_months), storeCount: Number(row.store_count) }))
  };
  const serialized = JSON.stringify(payload);
  const checksum = createHash("sha256").update(serialized).digest("hex");
  const snapshotDate = new Date(now); snapshotDate.setUTCHours(0, 0, 0, 0);
  await database.client`
    insert into delayed_snapshots (snapshot_date, source_cutoff_at, payload, checksum)
    values (${snapshotDate.toISOString()}::date, ${cutoffIso}::timestamptz, ${serialized}::jsonb, ${checksum})
    on conflict (snapshot_date) do update set source_cutoff_at = excluded.source_cutoff_at, payload = excluded.payload, checksum = excluded.checksum, created_at = now()
  `;
}

async function perform(job: Job) {
  if (["market.public_snapshot", "market.rebuild", "quarantine.recompute"].includes(job.kind)) await createPublicSnapshot();
  else throw new Error(`Unknown job kind: ${job.kind}`);
}

async function complete(job: Job) {
  await database.client`update jobs set status = 'completed', completed_at = now(), locked_at = null, locked_by = null where id = ${job.id}`;
}

async function fail(job: Job, error: unknown) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  const terminal = job.attempts >= job.max_attempts;
  await database.client`update jobs set status = ${terminal ? "failed" : "queued"}, last_error = ${message.slice(0, 10_000)}, locked_at = null, locked_by = null, run_after = now() + interval '1 minute' * ${Math.min(30, 2 ** job.attempts)} where id = ${job.id}`;
}

async function scheduleSnapshot() {
  await database.client`
    insert into jobs (kind, payload, run_after)
    select 'market.public_snapshot', '{}'::jsonb, now()
    where not exists (select 1 from jobs where kind = 'market.public_snapshot' and created_at > now() - interval '23 hours')
  `;
}

async function main() {
  console.log(JSON.stringify({ level: "info", event: "worker.started", workerId }));
  while (!stopping) {
    await scheduleSnapshot();
    const job = await claimJob();
    if (!job) { await new Promise((resolve) => setTimeout(resolve, 5_000)); continue; }
    try { await perform(job); await complete(job); }
    catch (error) { console.error(JSON.stringify({ level: "error", event: "job.failed", jobId: job.id, error: error instanceof Error ? error.message : String(error) })); await fail(job, error); }
  }
  await database.client.end();
}

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

main().catch((error) => { console.error(error); process.exitCode = 1; });
