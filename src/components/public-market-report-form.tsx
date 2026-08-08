"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PublicMarketReportForm({ itemId, itemName }: { itemId: string; itemName: string }) {
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
        locationType: values.get("locationType"),
        displayName: String(values.get("displayName") ?? "").trim()
      })
    });
    if (response.status === 401) { router.push(`/login?returnTo=${encodeURIComponent(`/guide/items/${itemId}#market-report`)}`); return; }
    if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; setState("error"); setMessage(body?.error === "invalid_request" ? "Check the quantity, price, and character name." : "Your report could not be submitted. Please try again."); return; }
    form.reset(); setState("success"); setMessage("Thank you. Your report is pending administrator review and will not change store stock.");
  }

  return <section id="market-report" className="panel"><div className="panel-head"><div><p className="eyebrow">MARKET REPORT</p><h2>Share a recent sale</h2></div></div>
    <p>Did you buy this item somewhere recently? Please report your sale to contribute to our market analysis!</p>
    <form className="stack" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
      <label>Character name<input name="displayName" required maxLength={100} placeholder="Your in-game name" /></label>
      <div className="grid receipt-line"><label>Quantity<input name="quantity" type="number" min="1" step="1" required /></label><label>Total paid (g)<input name="totalSeptims" type="number" min="0" step="1" required /></label></div>
      <label>Where was it sold?<select name="locationType" defaultValue="store_sale"><option value="store_sale">Store sale</option><option value="street_sale">Street sale</option></select></label>
      <button className="primary" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "Submitting…" : `Report ${itemName} sale`}</button>
      {message && <p className={state === "error" ? "notice error" : "fine"} role={state === "error" ? "alert" : "status"}>{message}</p>}
    </form>
  </section>;
}
