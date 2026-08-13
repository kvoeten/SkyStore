"use client";

import { useEffect, useState } from "react";
import { formatGold } from "@/lib/money";
import type { PublicEstimate, PublicFavorite, PublicHotItem, PublicOfficialRule } from "@/lib/public-market";

type Highlights = { hotItems: PublicHotItem[]; allTimeFavorites: PublicFavorite[]; official: PublicOfficialRule[]; estimates: PublicEstimate[] };
type HighlightLink = { key: string; name: string; detail: string; href: string; itemId?: string; match?: RegExp; price?: number | null };

const CURATED_HOT_ITEMS: HighlightLink[] = [
  { key: "soul-gems", name: "Soul Gems (Petty & Regular)", detail: "Strong current demand", href: "/guide?q=Soul%20Gem", match: /^(?:Petty|Common) Soul Gem$/i },
  { key: "leather", name: "Leather", detail: "Strong current demand", href: "/guide/items/01b56501-e797-5fe9-9de6-64b6b339f219", itemId: "01b56501-e797-5fe9-9de6-64b6b339f219" },
  { key: "spell-tomes", name: "Spell Tomes", detail: "Any spell school", href: "/guide?q=Spell%20Tome", match: /^Spell Tome:/i },
  { key: "mage-robes", name: "Mage Robes", detail: "Strong current demand", href: "/guide?q=Mage%20Robes", match: /^Mage Robes(?: Variant)?$/i },
  { key: "cure-disease", name: "Potion of Cure Disease", detail: "Strong current demand", href: "/guide/items/e9631a99-4240-5732-995d-b8be3c9ceb23", itemId: "e9631a99-4240-5732-995d-b8be3c9ceb23" },
];

const CURATED_FAVORITES: HighlightLink[] = [
  { key: "arrows", name: "Arrows", detail: "Frequently traded", href: "/guide?q=Arrow", match: / Arrow$/i },
  { key: "charcoal", name: "Charcoal", detail: "Frequently traded", href: "/guide?q=Charcoal", match: /^Charcoal$/i },
  { key: "wheat", name: "Wheat", detail: "Frequently traded", href: "/guide/items/f65bd795-9f11-5a92-ab99-c7670387bd25", itemId: "f65bd795-9f11-5a92-ab99-c7670387bd25" },
  { key: "common-clothes", name: "Common Clothes", detail: "Frequently traded variants", href: "/guide/items/e5b1a3f8-81dd-5ee0-b6b5-51b1e24b9eeb", match: /^Common Clothes(?:\s|$)/i },
  { key: "common-robes", name: "Common Robes", detail: "Frequently traded variants", href: "/guide/items/f99dc8de-fb3a-56cd-8e0d-c6373e4edb88", match: /^Common Robes(?:\s|$)/i },
];

export function PublicMarketHighlights() {
  const [state, setState] = useState<Highlights | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/market/public", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((value: Partial<Highlights>) => setState({ hotItems: value.hotItems ?? [], allTimeFavorites: value.allTimeFavorites ?? [], official: value.official ?? [], estimates: value.estimates ?? [] }))
      .catch(() => { if (!controller.signal.aborted) setState({ hotItems: [], allTimeFavorites: [], official: [], estimates: [] }); });
    return () => controller.abort();
  }, []);

  const hotItems = resolveHighlights(state, state?.hotItems.length
    ? state.hotItems.map((item) => ({ key: item.itemId, itemId: item.itemId, name: item.name, detail: `${item.unitsSold} sold · ${item.tradeCount} sales`, href: `/guide/items/${item.itemId}` }))
    : CURATED_HOT_ITEMS);
  const favorites = resolveHighlights(state, state?.allTimeFavorites.length
    ? state.allTimeFavorites.map((item) => ({ key: item.itemId, itemId: item.itemId, name: item.name, detail: `${item.tradeCount} sales · ${item.activeMonths} active months`, href: `/guide/items/${item.itemId}` }))
    : CURATED_FAVORITES);

  return <>
    <section className="card"><p className="eyebrow">CURRENT DEMAND</p><h2>Hot Items</h2>
      {!hotItems ? <p className="fine">Loading sales…</p> : <HighlightList entries={hotItems}/>}
    </section>
    <section className="card"><p className="eyebrow">LONG-RUN DEMAND</p><h2>All-Time Favorites</h2>
      {!favorites ? <p className="fine">Loading sales…</p> : <HighlightList entries={favorites} favorites/>}
    </section>
  </>;
}

function resolveHighlights(state: Highlights | null, entries: HighlightLink[]): HighlightLink[] | null {
  if (!state) return null;
  return entries.map((entry) => ({ ...entry, price: highestPublicPrice(state, entry) }));
}

function highestPublicPrice(state: Highlights, entry: HighlightLink): number | null {
  const matches = (candidate: { itemId: string; name: string }) => candidate.itemId === entry.itemId || Boolean(entry.match?.test(candidate.name));
  const estimates = state.estimates.filter(matches).map((estimate) => Number(estimate.upperQuartile ?? estimate.median)).filter(Number.isFinite);
  const official = state.official.filter(matches).map((rule) => rule.quantity[0] > 0 ? Number(rule.septims[1]) / Number(rule.quantity[0]) : Number.NaN).filter(Number.isFinite);
  const prices = [...estimates, ...official];
  return prices.length ? Math.max(...prices) : null;
}

function HighlightList({ entries, favorites = false }: { entries: HighlightLink[]; favorites?: boolean }) {
  return <ol className={`rank-list${favorites ? " favorites" : ""}`}>{entries.map((item) => <li key={item.key}><a href={item.href}><b>{item.name}</b><strong className="rank-price">{item.price == null ? "Store Price pending" : `Store Price ${formatGold(item.price)}`}</strong><span>{item.detail}</span></a></li>)}</ol>;
}
