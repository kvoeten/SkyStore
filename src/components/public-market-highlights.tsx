"use client";

import { useEffect, useState } from "react";
import type { PublicFavorite, PublicHotItem } from "@/lib/public-market";

type Highlights = { hotItems: PublicHotItem[]; allTimeFavorites: PublicFavorite[] };

export function PublicMarketHighlights() {
  const [state, setState] = useState<Highlights | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/market/public", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((value: Partial<Highlights>) => setState({ hotItems: value.hotItems ?? [], allTimeFavorites: value.allTimeFavorites ?? [] }))
      .catch(() => { if (!controller.signal.aborted) setState({ hotItems: [], allTimeFavorites: [] }); });
    return () => controller.abort();
  }, []);

  return <>
    <section className="card"><p className="eyebrow">LAST 30 DAYS</p><h2>Hot Items</h2>
      {!state ? <p className="fine">Loading sales…</p> : state.hotItems.length ? <ol className="rank-list">{state.hotItems.map((item) => <li key={item.itemId}><a href={`/guide/items/${item.itemId}`}><b>{item.name}</b><span>{item.unitsSold} sold · {item.tradeCount} sales</span></a></li>)}</ol> : <p className="fine">No sales history yet.</p>}
    </section>
    <section className="card"><p className="eyebrow">LONG-RUN ACTIVITY</p><h2>All-Time Favorites</h2>
      {!state ? <p className="fine">Loading sales…</p> : state.allTimeFavorites.length ? <ol className="rank-list favorites">{state.allTimeFavorites.map((item) => <li key={item.itemId}><a href={`/guide/items/${item.itemId}`}><b>{item.name}</b><span>{item.tradeCount} sales · {item.activeMonths} active months</span></a></li>)}</ol> : <p className="fine">Favorites will appear as sales history builds.</p>}
    </section>
  </>;
}
