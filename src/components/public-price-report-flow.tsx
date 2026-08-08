"use client";

import { useEffect, useState } from "react";
import { PublicMarketReportForm } from "@/components/public-market-report-form";

type CatalogItem = { id: string; name: string; category: string };

export function PublicPriceReportFlow() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [items, setItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setState("loading");
      fetch(`/api/v1/catalog/public-items?q=${encodeURIComponent(search)}`, { signal: controller.signal, headers: { accept: "application/json" } })
        .then(async (response) => {
          if (!response.ok) throw new Error("catalog unavailable");
          return response.json() as Promise<{ items?: CatalogItem[] }>;
        })
        .then((payload) => { setItems((payload.items ?? []).slice(0, 12)); setState("ready"); })
        .catch((error: unknown) => { if ((error as Error).name !== "AbortError") { setItems([]); setState("error"); } });
    }, 180);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query]);

  if (selected) return <PublicMarketReportForm itemId={selected.id} itemName={selected.name} onChangeItem={() => setSelected(null)}/>;

  return <section className="panel public-report-picker">
    <div className="panel-head"><div><p className="eyebrow">SELECT ITEM</p><h2>What price did you see?</h2></div></div>
    <p>Search the complete Keizaal catalog. Items do not need to be in store stock or already have a published price.</p>
    <label className="field"><span>Item name</span><div className="public-report-search"><input autoFocus type="search" value={query} onChange={(event) => { const value = event.target.value; setQuery(value); if (value.trim().length < 2) { setItems([]); setState("idle"); } }} placeholder="For example: iron ore, wheat, healing potion" aria-label="Search the Keizaal catalog"/></div></label>
    {state === "loading" && <p className="fine" role="status">Searching catalog…</p>}
    {state === "error" && <div className="notice error" role="alert"><b>Catalog search unavailable</b><span>Try again in a moment.</span></div>}
    {state === "ready" && !items.length && <div className="notice"><b>No matching items</b><span>Try another name or a broader search.</span></div>}
    {items.length > 0 && <ul className="public-report-results">{items.map((item) => <li key={item.id}><button type="button" onClick={() => setSelected(item)}><b>{item.name}</b><small>{item.category}</small></button></li>)}</ul>}
  </section>;
}
