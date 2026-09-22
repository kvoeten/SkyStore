"use client";

import { useState } from "react";

function localTimestamp(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function PublicMarketReportForm({ itemId, itemName, appliesToCount = 1, onChangeItem }: { itemId: string; itemName: string; appliesToCount?: number; onChangeItem?: () => void }) {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    setState("submitting"); setMessage("");
    const response = await fetch("/api/v1/market/reports", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        itemId,
        quantity: Number(values.get("quantity")),
        totalSeptims: Number(values.get("totalSeptims")),
        locationType: String(values.get("locationType") || "street_sale"),
        sourceLocation: String(values.get("sourceLocation") || "") || undefined,
        occurrenceAt: String(values.get("occurrenceAt") || "") || undefined
      })
    });
    if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; setState("error"); setMessage(body?.error === "invalid_market_report" ? "Check the quantity and total paid." : "Your report could not be submitted. Please try again."); return; }
    const payload = await response.json().catch(() => null) as { status?: "approved" | "pending" } | null;
    form.reset(); setState("success"); setMessage(payload?.status === "approved" ? "Price published. It will now appear in the public market timeline." : "Thank you. Your report is queued for administrator review and will not change store stock.");
  }

  return <section id="market-report" className="panel"><div className="panel-head"><div><p className="eyebrow">MARKET REPORT</p><h2>Report a price</h2></div>{onChangeItem && <button className="text-button" type="button" onClick={onChangeItem}>Choose another item</button>}</div>
    <p>Tell us what <b>{itemName}</b> recently traded for. Signed-in reports publish immediately; anonymous reports are reviewed first.</p>
    {appliesToCount > 1 && <p className="fine">One report applies to all {appliesToCount} equivalent Tailoring variants in this group.</p>}
    <form className="stack" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
      <div className="grid form-grid"><label className="field"><span>Quantity</span><input name="quantity" type="number" min="1" step="1" defaultValue="1" required /></label><label className="field"><span>Price paid (g)</span><input name="totalSeptims" type="number" min="0" step="1" required /></label><label className="field"><span>Price source</span><select name="locationType" defaultValue="street_sale"><option value="street_sale">Street trade</option><option value="store_sale">Store sale</option></select></label><label className="field"><span>Location</span><input name="sourceLocation" maxLength={180} placeholder="Optional, e.g. Whiterun market" /></label><label className="field"><span>Price time</span><input name="occurrenceAt" type="datetime-local" defaultValue={localTimestamp()} required /></label></div>
      <button className="button" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "Submitting…" : "Report price"}</button>
      {message && <p className={state === "error" ? "notice error" : "fine"} role={state === "error" ? "alert" : "status"}>{message}</p>}
    </form>
    <p className="fine">Price reports never change store stock. Sign in to publish straight away, or submit anonymously for review.</p>
  </section>;
}
