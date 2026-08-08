"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PublicMarketReportForm({ itemId, itemName, onChangeItem }: { itemId: string; itemName: string; onChangeItem?: () => void }) {
  const router = useRouter();
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
        displayName: String(values.get("displayName") ?? "").trim()
      })
    });
    if (response.status === 401) { router.push(`/login?returnTo=${encodeURIComponent(`/guide/items/${itemId}#market-report`)}`); return; }
    if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; setState("error"); setMessage(body?.error === "invalid_market_report" ? "Check the quantity, price, and character name." : "Your report could not be submitted. Please try again."); return; }
    form.reset(); setState("success"); setMessage("Thank you. Your report is pending administrator review and will not change store stock.");
  }

  return <section id="market-report" className="panel"><div className="panel-head"><div><p className="eyebrow">MARKET REPORT</p><h2>Report a street price</h2></div>{onChangeItem && <button className="text-button" type="button" onClick={onChangeItem}>Choose another item</button>}</div>
    <p>Tell us what <b>{itemName}</b> recently traded for outside a participating store.</p>
    <form className="stack" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
      <label className="field"><span>Character name</span><input name="displayName" required maxLength={100} placeholder="Your in-game name" /></label>
      <div className="grid form-grid"><label className="field"><span>Quantity</span><input name="quantity" type="number" min="1" step="1" defaultValue="1" required /></label><label className="field"><span>Total paid (g)</span><input name="totalSeptims" type="number" min="0" step="1" required /></label></div>
      <button className="button" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "Submitting…" : "Report price"}</button>
      {message && <p className={state === "error" ? "notice error" : "fine"} role={state === "error" ? "alert" : "status"}>{message}</p>}
    </form>
    <p className="fine">Public reports never change store stock. Every report remains hidden until an administrator approves it.</p>
  </section>;
}
