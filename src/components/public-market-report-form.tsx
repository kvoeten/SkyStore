"use client";

import { useState } from "react";
import { DEFAULT_MARKET_REGION, SKYRIM_HOLDS } from "@/lib/market/holds";
import { formatGold, goldBundleFromUnitPrice } from "@/lib/money";

function localTimestamp(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function PublicMarketReportForm({ itemId, itemName, appliesToCount = 1, onChangeItem }: { itemId: string; itemName: string; appliesToCount?: number; onChangeItem?: () => void }) {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [bulkQuantity, setBulkQuantity] = useState(1);
  const [bulkTotal, setBulkTotal] = useState(0);

  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const unitBundle = goldBundleFromUnitPrice(Number(values.get("unitPrice")));
    if (!advanced && !unitBundle) {
      setState("error");
      setMessage("Use a value with no more than two decimal places, such as 0.25g or 1.5g.");
      return;
    }
    const quantity = advanced ? Number(values.get("quantity")) : unitBundle!.quantity;
    const totalSeptims = advanced ? Number(values.get("totalSeptims")) : unitBundle!.totalSeptims;
    setState("submitting"); setMessage("");
    let response: Response;
    try {
      response = await fetch("/api/v1/market/reports", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemId,
          quantity,
          totalSeptims,
          priceType: String(values.get("priceType") || "street_value"),
          sourceLocation: String(values.get("sourceLocation") || DEFAULT_MARKET_REGION),
          occurrenceAt: advanced ? String(values.get("occurrenceAt") || "") || undefined : undefined
        })
      });
    } catch {
      setState("error");
      setMessage("Your report could not be submitted. Check your connection and try again.");
      return;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      setState("error");
      setMessage(body?.error === "invalid_market_report" ? "Enter a valid price and, for a bulk trade, a whole-gold total with a valid quantity." : "Your report could not be submitted. Please try again.");
      return;
    }
    const payload = await response.json().catch(() => null) as { status?: "approved" | "pending" } | null;
    form.reset(); setAdvanced(false); setBulkQuantity(1); setBulkTotal(0); setState("success");
    setMessage(payload?.status === "approved" ? "Price published. It will now appear in the public market timeline." : "Thank you. Your report is queued for administrator review and will not change store stock.");
  }

  return <section id="market-report" className="panel">
    <div className="panel-head"><div><p className="eyebrow">MARKET REPORT</p><h2>Report a price</h2></div>{onChangeItem && <button className="text-button" type="button" onClick={onChangeItem}>Choose another item</button>}</div>
    <p>Report the per-item price for <b>{itemName}</b>.</p>
    {appliesToCount > 1 && <p className="fine">One report applies to all {appliesToCount} equivalent Tailoring variants in this group.</p>}
    <form className="stack" aria-busy={state === "submitting"} onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
      <div className="grid form-grid report-basics">
        <label className="field"><span>Price per item (g)</span><input name="unitPrice" type="number" min="0" step="0.01" required={!advanced} autoFocus disabled={state === "submitting"} /></label>
        <label className="field"><span>Price type</span><select name="priceType" defaultValue="street_value" disabled={state === "submitting"}><option value="street_value">Street value</option><option value="store_buying_price">Store buying price</option><option value="store_selling_price">Store selling price</option></select></label>
        <label className="field"><span>Region</span><select name="sourceLocation" defaultValue={DEFAULT_MARKET_REGION} disabled={state === "submitting"}>{SKYRIM_HOLDS.map((hold) => <option key={hold} value={hold}>{hold}</option>)}</select></label>
      </div>
      <details className="report-advanced" onToggle={(event) => setAdvanced(event.currentTarget.open)}>
        <summary>Advanced: bulk trade or time</summary>
        <div className="grid form-grid">
          <label className="field"><span>Quantity</span><input name="quantity" type="number" min="1" step="1" defaultValue="1" onChange={(event) => setBulkQuantity(Number(event.target.value))} required={advanced} disabled={state === "submitting"} /></label>
          <label className="field"><span>Total paid (g)</span><input name="totalSeptims" type="number" min="0" step="1" onChange={(event) => setBulkTotal(Number(event.target.value))} required={advanced} disabled={state === "submitting"} /></label>
          <div className="bulk-unit-value"><span>Calculated unit price</span><b>{bulkQuantity > 0 && Number.isFinite(bulkTotal) ? formatGold(bulkTotal / bulkQuantity) : "—"}</b></div>
          <label className="field"><span>Price time</span><input name="occurrenceAt" type="datetime-local" defaultValue={localTimestamp()} required={advanced} disabled={state === "submitting"} /></label>
        </div>
      </details>
      <button className="button" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "Submitting…" : "Report price"}</button>
      {state === "submitting" && <p className="fine" role="status">Submitting your price report…</p>}
      {message && <p className={state === "error" ? "notice error" : "fine"} role={state === "error" ? "alert" : "status"}>{message}</p>}
    </form>
    <p className="fine">Price reports never change store stock. Sign in to publish straight away, or submit anonymously for review.</p>
  </section>;
}
