"use client";

import { useEffect, useState } from "react";
import { DEFAULT_MARKET_REGION, SKYRIM_HOLDS } from "@/lib/market/holds";

type CatalogItem = { id: string; name: string; category: string };
type ReportRow = { key: number; query: string; item?: CatalogItem; price: string; location: string; occurredAt: string };
const timestamp = () => { const now = new Date(); const pad = (v: number) => String(v).padStart(2, "0"); return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`; };
const blank = (key: number): ReportRow => ({ key, query: "", price: "", location: DEFAULT_MARKET_REGION, occurredAt: timestamp() });

function RowItemSearch({ row, onPick, onQuery }: { row: ReportRow; onPick: (item: CatalogItem) => void; onQuery: (value: string) => void }) {
  const [matches, setMatches] = useState<CatalogItem[]>([]);
  useEffect(() => { const query = row.query.trim(); if (query.length < 2 || row.item) return; const abort = new AbortController(); const timer = window.setTimeout(() => fetch(`/api/v1/catalog/public-items?q=${encodeURIComponent(query)}`, { signal: abort.signal }).then((response) => response.ok ? response.json() : { items: [] }).then((payload: { items?: CatalogItem[] }) => setMatches((payload.items ?? []).slice(0, 5))).catch(() => undefined), 160); return () => { window.clearTimeout(timer); abort.abort(); }; }, [row.item, row.query]);
  const canShowMatches = !row.item && row.query.trim().length >= 2;
  return <div className="bulk-item-search"><input value={row.item?.name ?? row.query} onChange={(event) => onQuery(event.target.value)} placeholder="Item name" aria-label="Item name" required/>{canShowMatches && matches.length > 0 && <div className="bulk-matches">{matches.map((item) => <button type="button" key={item.id} onClick={() => onPick(item)}><b>{item.name}</b><small>{item.category}</small></button>)}</div>}</div>;
}

export function BulkPriceReport() {
  const [rows, setRows] = useState<ReportRow[]>([blank(1), blank(2), blank(3)]);
  const [message, setMessage] = useState<string | null>(null);
  const update = (key: number, patch: Partial<ReportRow>) => setRows((items) => items.map((row) => row.key === key ? { ...row, ...patch } : row));
  const add = () => setRows((items) => [...items, blank(Math.max(...items.map((row) => row.key), 0) + 1)]);
  async function submit() {
    const ready = rows.map((row) => ({ row, price: Number(row.price) })).filter((entry): entry is { row: ReportRow; price: number } => Boolean(entry.row.item && Number.isInteger(entry.price) && entry.price >= 0));
    if (!ready.length) { setMessage("Choose at least one item and enter its whole-gold value."); return; }
    setMessage("Saving reports…");
    const results = await Promise.all(ready.map(({ row, price }) => fetch("/api/v1/market/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: row.item!.id, quantity: 1, totalSeptims: price, locationType: "street_sale", sourceLocation: row.location, occurrenceAt: row.occurredAt }) })));
    const failed = results.filter((result) => !result.ok).length;
    if (failed) { setMessage(`${ready.length - failed} saved; ${failed} could not be submitted.`); return; }
    setRows([blank(1), blank(2), blank(3)]); setMessage(`${ready.length} price reports submitted. Signed-in reports are live; anonymous reports await review.`);
  }
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">BULK MARKET REPORT</p><h2>Enter several prices at once</h2></div><button className="outline" type="button" onClick={add}>Add row</button></div><p>Each row records a single item value in whole gold. Every report is a street price and never affects inventory.</p><div className="bulk-report-grid"><div className="bulk-head">Item</div><div className="bulk-head">Value (g)</div><div className="bulk-head">Region</div><div className="bulk-head">Time</div>{rows.map((row) => <div className="bulk-row" key={row.key}><RowItemSearch row={row} onQuery={(query) => update(row.key, { query, item: undefined })} onPick={(item) => update(row.key, { item, query: item.name })}/><input type="number" min="0" step="1" value={row.price} onChange={(event) => update(row.key, { price: event.target.value })} aria-label="Value in gold"/><select value={row.location} onChange={(event) => update(row.key, { location: event.target.value })} aria-label="Region">{SKYRIM_HOLDS.map((hold) => <option value={hold} key={hold}>{hold}</option>)}</select><input type="datetime-local" value={row.occurredAt} onChange={(event) => update(row.key, { occurredAt: event.target.value })} aria-label="Price time"/></div>)}</div><div className="button-row"><button className="button" type="button" onClick={() => void submit()}>Submit filled rows</button></div>{message && <p className="notice" role="status">{message}</p>}</section>;
}
