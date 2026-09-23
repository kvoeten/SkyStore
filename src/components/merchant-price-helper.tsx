"use client";

import { useMemo, useState } from "react";
import { formatGold, roundPurchaseGold, roundSaleGold } from "@/lib/money";

export function MerchantPriceHelper({ value }: { value: number | null }) {
  const [quantity, setQuantity] = useState(1);
  const [purchaseCost, setPurchaseCost] = useState(value == null ? 0 : roundPurchaseGold(value * .5));
  const [discount, setDiscount] = useState(0);
  const totals = useMemo(() => {
    const safeQuantity = Math.max(1, Number.isFinite(quantity) ? quantity : 1);
    const cost = roundPurchaseGold(purchaseCost);
    const base = value ?? 0;
    return { safeQuantity, cost, base, customerTotal: roundSaleGold(base * safeQuantity * (1 - discount / 100)) };
  }, [discount, purchaseCost, quantity, value]);

  if (value == null) return <section className="card helper-card"><p className="eyebrow">BULK CALCULATOR</p><h2>Price pending</h2><p className="fine">A calculator will appear when this item has a market value.</p></section>;

  return <section className="card helper-card"><p className="eyebrow">BULK CALCULATOR</p><h2>Customer total</h2>
    <div className="stack helper-controls"><label className="field"><span>Quantity</span><input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}/></label><label className="field"><span>Your buying cost per item (g)</span><input type="number" min="0" step="1" value={purchaseCost} onChange={(event) => setPurchaseCost(roundPurchaseGold(Number(event.target.value)))}/></label><label className="field"><span>Bulk discount</span><select value={discount} onChange={(event) => setDiscount(Number(event.target.value))}>{[0, 5, 10, 15, 20].map((option) => <option key={option} value={option}>{option}%</option>)}</select></label></div>
    <div className="helper-total"><span>Customer pays at market value</span><b>{formatGold(totals.customerTotal)}</b><small>{totals.safeQuantity} × {formatGold(totals.base)}{discount ? ` · ${discount}% discount` : ""}</small></div>
  </section>;
}
