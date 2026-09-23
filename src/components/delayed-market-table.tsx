"use client";

/* eslint-disable @next/next/no-img-element -- image paths are validated local catalog assets. */

import { useEffect, useState } from "react";
import { prioritizeMarketGuideRows } from "@/lib/market/guide-ranking";
import { formatGold } from "@/lib/money";
import { isMarketItemDisplayable } from "@/lib/catalog/market-item-filter";

type Trend = { direction: "up" | "down" | "flat"; percent: number; points?: { at: string; customerPays: number | null }[] };
type Row = { id: string; name: string; category?: string; imageUrl?: string | null; value?: string; region?: string; unitPrice?: number; catalogMatch?: boolean; trend?: Trend; hasPrice: boolean; lastChangedAt?: string | null; lastSoldAt?: string | null };
type Official = { itemId: string; name: string; side: "customer_pays" | "store_pays"; septims: [number, number]; quantity: [number, number]; effectiveFrom?: string; region?: string };
type Estimate = { itemId: string; name: string; side: "customer_pays" | "store_pays"; lowerQuartile: number | null; upperQuartile: number | null; newestEvidenceAt?: string | null };
type CatalogItem = { id: string; name: string; category: string; imageUrl?: string | null; familyItemIds?: string[] };
type MarketPayload = { sourceCutoffAt: string; official?: Official[]; estimates?: Estimate[]; images?: Record<string, string>; trends?: Record<string, Trend> };

function normalize(payload: MarketPayload, catalogMatches: CatalogItem[] = []): Row[] {
  const rows = new Map<string, Row>();
  const canonical = new Map<string, string>();
  for (const item of catalogMatches) for (const memberId of item.familyItemIds ?? [item.id]) canonical.set(memberId, item.id);
  for (const item of catalogMatches.filter(isMarketItemDisplayable)) rows.set(item.id, { id: item.id, name: item.name, category: item.category, imageUrl: item.imageUrl, catalogMatch: true, hasPrice: false });
  for (const rule of payload.official ?? []) {
    if (!isMarketItemDisplayable(rule)) continue;
    const itemId = canonical.get(rule.itemId) ?? rule.itemId;
    const row = rows.get(itemId) ?? { id: itemId, name: rule.name, hasPrice: false };
    const unitPrice = rule.quantity[0] > 0 ? rule.septims[1] / rule.quantity[0] : 0;
    if (rule.side === "customer_pays" && (row.unitPrice == null || unitPrice > row.unitPrice)) { row.value = formatGold(unitPrice); row.unitPrice = unitPrice; row.region = rule.region ?? "Whiterun"; }
    if (!row.lastChangedAt || (rule.effectiveFrom && Date.parse(rule.effectiveFrom) > Date.parse(row.lastChangedAt))) row.lastChangedAt = rule.effectiveFrom;
    row.imageUrl ??= payload.images?.[rule.itemId];
    row.hasPrice = Boolean(row.value);
    rows.set(itemId, row);
  }
  for (const estimate of payload.estimates ?? []) {
    if (!isMarketItemDisplayable(estimate)) continue;
    const itemId = canonical.get(estimate.itemId) ?? estimate.itemId;
    const row = rows.get(itemId) ?? { id: itemId, name: estimate.name, hasPrice: false };
    row.imageUrl ??= payload.images?.[estimate.itemId];
    if (estimate.side === "customer_pays" && estimate.upperQuartile != null && (row.unitPrice == null || estimate.upperQuartile > row.unitPrice)) { row.value = formatGold(estimate.upperQuartile); row.unitPrice = estimate.upperQuartile; row.region ??= "Whiterun"; }
    rows.set(itemId, row);
    row.hasPrice = Boolean(row.value);
    row.lastSoldAt = estimate.newestEvidenceAt;
    if (!row.lastChangedAt || (estimate.newestEvidenceAt && Date.parse(estimate.newestEvidenceAt) > Date.parse(row.lastChangedAt))) row.lastChangedAt = estimate.newestEvidenceAt;
  }
  for (const row of rows.values()) row.trend = payload.trends?.[row.id] ?? catalogMatches.find((item) => item.id === row.id)?.familyItemIds?.map((id) => payload.trends?.[id]).find(Boolean);
  const normalized = [...rows.values()];
  return prioritizeMarketGuideRows(catalogMatches.length ? normalized : normalized.filter((row) => row.hasPrice));
}

function trendVisual(trend?: Trend) {
  const values = trend?.points?.map((point) => point.customerPays).filter((price): price is number => price != null) ?? [];
  if (!values.length) return <span className="trend-visual flat" title="No price movement recorded"><svg viewBox="0 0 72 24" role="img" aria-label="No price movement recorded"><polyline points="3,12 69,12"/></svg><small>+0.0%</small></span>;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = maximum - minimum;
  const points = values.map((price, index) => {
    const x = values.length === 1 ? 36 : 3 + (index / (values.length - 1)) * 66;
    const y = spread === 0 ? 12 : 21 - ((price - minimum) / spread) * 18;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const change = `${trend?.percent && trend.percent > 0 ? "+" : ""}${(trend?.percent ?? 0).toFixed(1)}%`;
  const label = `Four-week price change ${change}`;
  return <span className={`trend-visual ${trend?.direction ?? "new"}`} title={label}>
    <svg viewBox="0 0 72 24" role="img" aria-label={label}>{values.length === 1 ? <circle cx="36" cy="12" r="2.5"/> : <polyline points={points}/>}</svg>
    <small>{change}</small>
  </span>;
}

export function DelayedMarketTable({ query = "" }: { query?: string }) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "empty" | "error"; rows: Row[]; message?: string }>({ status: "loading", rows: [] });
  useEffect(() => {
    const controller = new AbortController();
    const market = fetch("/api/v1/market/public", { signal: controller.signal, headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? "The guide is still being prepared." : "The guide could not be loaded.");
        return response.json() as Promise<MarketPayload>;
      });
    const catalog = query.trim()
      ? fetch(`/api/v1/catalog/public-items?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal, headers: { accept: "application/json" } })
        .then(async (response) => response.ok ? response.json() as Promise<{ items?: CatalogItem[] }> : { items: [] })
      : Promise.resolve({ items: [] as CatalogItem[] });
    Promise.all([market, catalog])
      .then(([payload, catalogMatches]) => {
        const rows = normalize(payload, catalogMatches.items ?? []);
        setState({ status: rows.length ? "ready" : "empty", rows });
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError") setState({ status: "error", rows: [], message: error instanceof Error ? error.message : "The guide could not be loaded." });
      });
    return () => controller.abort();
  }, [query]);

  if (state.status === "loading") return <div className="notice" role="status"><b>Opening the market ledger…</b><span>Loading published prices.</span></div>;
  if (state.status === "error") return <div className="notice error" role="alert"><b>Guide unavailable</b><span>{state.message}</span></div>;
  if (state.status === "empty") return <div className="notice" role="status"><b>No prices published yet</b><span>Current official prices will appear here as soon as they are added.</span></div>;
  const visibleRows = query.trim() ? state.rows.filter((row) => row.catalogMatch || `${row.name} ${row.category ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : state.rows.filter((row) => row.hasPrice);
  return visibleRows.length ? <div className="table-wrap"><table className="market-guide-table"><thead><tr><th>Item</th><th>Value</th><th>Region</th><th>Trend</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id}><td><a href={`/guide/items/${row.id}`} className="item-name">{row.imageUrl ? <img src={row.imageUrl} alt="" width="38" height="38" style={{ flex: "0 0 auto", objectFit: "contain", padding: 4, border: "1px solid #9f7b42", borderRadius: 2, background: "#252b33" }}/> : <span className="item-dot">◇</span>}<span>{row.name}<br/><small>{row.category ?? "Market item"}</small></span></a></td><td>{row.value ?? "Not yet priced"}</td><td>{row.region ?? "Whiterun"}</td><td>{trendVisual(row.trend)}</td></tr>)}</tbody></table></div> : <div className="empty"><b>No matching items.</b><p>Try another item name or category.</p></div>;
}
