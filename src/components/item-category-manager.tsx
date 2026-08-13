"use client";

import { useState, type FormEvent } from "react";
import { MARKET_CATEGORIES } from "@/lib/catalog/market-categories";

type Item = { id: string; name: string; category: string; marketCategory: string | null; effectiveMarketCategory: string | null };

export function ItemCategoryManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("");
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("q") ?? "");
    const response = await fetch(`/api/v1/catalog/items?q=${encodeURIComponent(query)}`);
    const payload = await response.json().catch(() => ({}));
    setItems(response.ok ? payload.items ?? [] : []);
    setMessage(response.ok ? "" : payload.error ?? "Search failed.");
  }
  async function update(itemId: string, category: string) {
    const selected = category || null;
    const response = await fetch(`/api/v1/catalog/items/${itemId}/category`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: selected }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(payload.error ?? "Category update failed.");
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, marketCategory: selected, effectiveMarketCategory: selected } : item));
    setMessage("Category saved.");
  }
  return <section className="panel" style={{ marginTop: 20 }}>
    <p className="eyebrow">MARKET CATEGORIES</p><h2>Correct item categories</h2>
    <p className="fine">Overrides survive future catalog imports. Clear an override to use SkyStore&apos;s automatic category.</p>
    <form className="button-row" onSubmit={search}><input name="q" type="search" required minLength={2} placeholder="Search item name"/><button className="outline" type="submit">Find items</button></form>
    {message && <p className="fine" role="status">{message}</p>}
    {items.length > 0 && <div className="table-wrap"><table><thead><tr><th>Item</th><th>Catalog category</th><th>Quick category</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><b>{item.name}</b></td><td>{item.category}</td><td><select value={item.marketCategory ?? ""} onChange={(event) => update(item.id, event.target.value)}><option value="">Automatic{item.effectiveMarketCategory ? ` (${item.effectiveMarketCategory})` : ""}</option>{MARKET_CATEGORIES.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></td></tr>)}</tbody></table></div>}
  </section>;
}
