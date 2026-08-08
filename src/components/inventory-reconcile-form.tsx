"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CatalogPicker, Field } from "@/components/forms";

export function InventoryReconcileForm({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [itemId, setItemId] = useState("");
  const [pickerKey, setPickerKey] = useState("initial");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSubmitting(true); setMessage(null);
    const response = await fetch(`/api/v1/store/inventory/reconcile?storeId=${encodeURIComponent(storeId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeId, itemId, actualQuantity: Number(form.get("actualQuantity")) })
    });
    setSubmitting(false);
    if (!response.ok) {
      setMessage({ ok: false, text: "The inventory count could not be updated." });
      return;
    }
    formElement.reset(); setItemId(""); setPickerKey(crypto.randomUUID());
    setMessage({ ok: true, text: "Inventory updated to the in-game count." });
    router.refresh();
  }

  return <section id="inventory-reconcile" className="panel" style={{ marginBottom: 20 }}>
    <div className="panel-head"><div><p className="eyebrow">QUICK STOCK UPDATE</p><h2>Set the current in-game quantity</h2></div></div>
    <form className="inventory-reconcile-grid" onSubmit={submit}>
      <Field label="Item"><CatalogPicker key={pickerKey} value={itemId} onChange={setItemId}/></Field>
      <Field label="Actual stock"><input name="actualQuantity" type="number" min="0" defaultValue="0" required /></Field>
      <button className="button" type="submit" disabled={submitting || !itemId}>{submitting ? "Updating…" : "Update stock"}</button>
    </form>
    {message && <p className={message.ok ? "positive" : "negative"} role="status">{message.text}</p>}
    <p className="fine">Any store member may reconcile this helper with the quantity currently visible in-game. The adjustment remains in the audit history.</p>
  </section>;
}
