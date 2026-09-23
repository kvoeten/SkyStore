"use client";

import { useEffect, useState } from "react";
import { DEFAULT_MARKET_REGION, SKYRIM_HOLDS } from "@/lib/market/holds";
import { goldBundleFromUnitPrice } from "@/lib/money";

type CatalogItem = { id: string; name: string; category: string };
type ReportRow = { key: number; query: string; item?: CatalogItem; price: string; priceType: "street_value" | "store_buying_price" | "store_selling_price"; location: string; occurredAt: string };
const timestamp = () => { const now = new Date(); const pad = (v: number) => String(v).padStart(2, "0"); return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`; };
const blank = (key: number): ReportRow => ({ key, query: "", price: "", priceType: "street_value", location: DEFAULT_MARKET_REGION, occurredAt: timestamp() });

function RowItemSearch({ row, onPick, onQuery, disabled }: { row: ReportRow; onPick: (item: CatalogItem) => void; onQuery: (value: string) => void; disabled: boolean }) {
  const [matches, setMatches] = useState<CatalogItem[]>([]);
  useEffect(() => { const query = row.query.trim(); if (query.length < 2 || row.item) return; const abort = new AbortController(); const timer = window.setTimeout(() => fetch(`/api/v1/catalog/public-items?q=${encodeURIComponent(query)}`, { signal: abort.signal }).then((response) => response.ok ? response.json() : { items: [] }).then((payload: { items?: CatalogItem[] }) => setMatches((payload.items ?? []).slice(0, 5))).catch(() => undefined), 160); return () => { window.clearTimeout(timer); abort.abort(); }; }, [row.item, row.query]);
  const canShowMatches = !row.item && row.query.trim().length >= 2;
  return <div className="bulk-item-search"><input value={row.item?.name ?? row.query} onChange={(event) => onQuery(event.target.value)} placeholder="Item name" aria-label="Item name" required disabled={disabled}/>{canShowMatches && matches.length > 0 && <div className="bulk-matches">{matches.map((item) => <button type="button" key={item.id} onClick={() => onPick(item)} disabled={disabled}><b>{item.name}</b><small>{item.category}</small></button>)}</div>}</div>;
}

export function BulkPriceReport() {
  const [rows, setRows] = useState<ReportRow[]>([blank(1), blank(2), blank(3)]);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const update = (key: number, patch: Partial<ReportRow>) => setRows((items) => items.map((row) => row.key === key ? { ...row, ...patch } : row));
  const add = () => { if (!submitting) setRows((items) => [...items, blank(Math.max(...items.map((row) => row.key), 0) + 1)]); };
  async function submit() {
    const ready = rows.map((row) => ({ row, bundle: goldBundleFromUnitPrice(Number(row.price)) })).filter((entry): entry is { row: ReportRow; bundle: NonNullable<ReturnType<typeof goldBundleFromUnitPrice>> } => Boolean(entry.row.item && entry.bundle));
    if (!ready.length) { setMessage("Choose at least one item and enter a valid value, such as 0.2g or 1g."); return; }
    setSubmitting(true); setMessage("Submitting reports…");
    try {
      const results = await Promise.all(ready.map(({ row, bundle }) => fetch("/api/v1/market/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: row.item!.id, quantity: bundle.quantity, totalSeptims: bundle.totalSeptims, priceType: row.priceType, sourceLocation: row.location, occurrenceAt: row.occurredAt }) })));
      const failed = results.filter((result) => !result.ok).length;
      if (failed) { setMessage(`${ready.length - failed} saved; ${failed} could not be submitted.`); return; }
      setRows([blank(1), blank(2), blank(3)]); setMessage(`${ready.length} price reports submitted. Signed-in reports are live; anonymous reports await review.`);
    } catch {
      setMessage("Reports could not be submitted. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }
  return <section className="panel" aria-busy={submitting}><div className="panel-head"><div><p className="eyebrow">BULK MARKET REPORT</p><h2>Enter several prices at once</h2></div><button className="outline" type="button" onClick={add} disabled={submitting}>Add row</button></div><p>Each row records a per-item value. Fractions are saved as exact whole-gold bundles, such as 0.2g as 1g for 5.</p><div className="bulk-report-grid"><div className="bulk-head">Item</div><div className="bulk-head">Price (g)</div><div className="bulk-head">Price type</div><div className="bulk-head">Region</div><div className="bulk-head">Time</div>{rows.map((row) => <div className="bulk-row" key={row.key}><RowItemSearch row={row} onQuery={(query) => update(row.key, { query, item: undefined })} onPick={(item) => update(row.key, { item, query: item.name })} disabled={submitting}/><input type="number" min="0" step="0.01" value={row.price} onChange={(event) => update(row.key, { price: event.target.value })} aria-label="Value in gold" disabled={submitting}/><select value={row.priceType} onChange={(event) => update(row.key, { priceType: event.target.value as ReportRow["priceType"] })} aria-label="Price type" disabled={submitting}><option value="street_value">Street value</option><option value="store_buying_price">Store buying price</option><option value="store_selling_price">Store selling price</option></select><select value={row.location} onChange={(event) => update(row.key, { location: event.target.value })} aria-label="Region" disabled={submitting}>{SKYRIM_HOLDS.map((hold) => <option value={hold} key={hold}>{hold}</option>)}</select><input type="datetime-local" value={row.occurredAt} onChange={(event) => update(row.key, { occurredAt: event.target.value })} aria-label="Price time" disabled={submitting}/></div>)}</div><div className="button-row"><button className="button" type="button" onClick={() => void submit()} disabled={submitting}>{submitting ? "Submitting reports…" : "Submit filled rows"}</button></div>{message && <p className="notice" role="status">{message}</p>}</section>;
}
