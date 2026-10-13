"use client";

import { useState } from "react";
import { formatGold, roundPurchaseGold, roundSaleGold } from "@/lib/money";

function presets(value: number | null, side: "buy" | "sell") {
  return (side === "buy" ? [-50, -30, -10] : [0, 10, 30]).map((percent) => {
    const raw = value == null ? null : value * (1 + percent / 100);
    return { percent, price: raw == null ? null : raw <= 1 ? Math.round(raw * 100) / 100 : (side === "buy" ? roundPurchaseGold(raw) : roundSaleGold(raw)) };
  });
}

export function MerchantPriceHelper({ value, buyingPrice, sellingPrice }: { value: number | null; buyingPrice?: number | null; sellingPrice?: number | null }) {
  const [quantity, setQuantity] = useState(1);
  const [side, setSide] = useState<"buy" | "sell">("sell");
  const [unitPrice, setUnitPrice] = useState(value ?? 0);
  const [discount, setDiscount] = useState(0);
  const options = presets(value, side);
  const opposite = presets(value, side === "buy" ? "sell" : "buy");
  const count = Math.max(1, Math.floor(Number.isFinite(quantity) ? quantity : 1));
  const price = Math.max(0, Number.isFinite(unitPrice) ? unitPrice : 0);
  const total = (side === "buy" ? roundPurchaseGold : roundSaleGold)(price * count * (1 - discount / 100));
  function changeSide(next: "buy" | "sell") {
    setSide(next);
    setUnitPrice(presets(value, next)[0].price ?? 0);
  }
  return <section className="card helper-card trade-assistant"><p className="eyebrow">TRADE ASSISTANT</p>
    <div className="trade-toggle" role="group" aria-label="Trade type">{(["buy", "sell"] as const).map((option) => <button key={option} type="button" aria-pressed={side === option} onClick={() => changeSide(option)}>{option === "buy" ? "Buying" : "Selling"}</button>)}</div>
    <p className="preset-label">{side === "buy" ? "Buying" : "Selling"} price presets</p>
    <div className={`trade-presets ${side}`} role="group" aria-label="Price presets">{options.map((option, index) => <button className={`preset-tone-${index}`} key={option.percent} type="button" disabled={option.price == null} aria-pressed={option.price != null && price === option.price} onClick={() => setUnitPrice(option.price!)}><span>{option.percent > 0 ? "+" : ""}{option.percent}%</span><b>{formatGold(option.price)}</b></button>)}</div>
    <p className="opposite-presets">{side === "buy" ? "Selling" : "Buying"} presets: {opposite.map((option) => `${option.percent > 0 ? "+" : ""}${option.percent}% ${formatGold(option.price)}`).join(" · ")}</p>
    <div className="helper-controls"><div className="trade-input-row"><label className="field"><span>Quantity</span><input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}/></label><label className="field"><span>Unit price (g)</span><input type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(Number(event.target.value))}/></label></div><label className="field"><span>Bulk discount</span><select value={discount} onChange={(event) => setDiscount(Number(event.target.value))}>{[0, 5, 10, 15, 20].map((option) => <option key={option} value={option}>{option}%</option>)}</select></label></div>
    <div className="helper-total" aria-live="polite"><span>{side === "buy" ? "Store pays" : "Customer pays"}</span><b>{formatGold(total)}</b><small>{count} × {formatGold(price)}{discount ? ` · ${discount}% discount` : ""}</small></div>
    {(buyingPrice != null || sellingPrice != null) && <small className="inspect-observed">Reported: buying {formatGold(buyingPrice)} · selling {formatGold(sellingPrice)}</small>}
  </section>;
}
