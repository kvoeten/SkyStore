"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

type CatalogOption = { id: string; displayName: string; category: string; plugin?: string | null };
type ReceiptLine = { key: string; itemId: string; quantity: number; totalSeptims: number };

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}</label>;
}

function SubmissionStatus({ status }: { status: { tone: "good" | "bad"; message: string } | null }) {
  if (!status) return null;
  return <p className={status.tone === "good" ? "positive" : "negative"} role="status">{status.message}</p>;
}

export function CatalogPicker({ value, onChange }: { value: string; onChange: (itemId: string) => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      const selected = !query && value ? `&id=${encodeURIComponent(value)}` : "";
      fetch(`/api/v1/items?q=${encodeURIComponent(query)}${selected}`, { signal: controller.signal })
        .then(async (response) => response.ok ? response.json() as Promise<{ items: CatalogOption[] }> : Promise.reject(new Error("catalog unavailable")))
        .then((payload) => setItems(payload.items))
        .catch((error: unknown) => { if ((error as Error).name !== "AbortError") setItems([]); })
        .finally(() => setLoading(false));
    }, 200);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query, value]);
  return <div className="catalog-picker"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the Keizaal catalog" aria-label="Search catalog items"/><select value={value} onChange={(event) => onChange(event.target.value)} required><option value="">{loading ? "Searching…" : "Select an item"}</option>{items.map((item) => <option key={item.id} value={item.id}>{item.displayName} · {item.category}{item.plugin ? ` · ${item.plugin}` : ""}</option>)}</select></div>;
}

function blankLine(key = "initial", itemId = ""): ReceiptLine {
  return { key, itemId, quantity: 1, totalSeptims: 0 };
}

function completedReturn(returnTo: string, pending: boolean) {
  return `${returnTo}${returnTo.includes("?") ? "&" : "?"}recorded=${pending ? "pending" : "saved"}`;
}

export function ReceiptForm({ direction, storeId, initialItemId = "", returnTo }: { direction: "purchase" | "sale"; storeId: string; initialItemId?: string; returnTo?: string }) {
  const router = useRouter();
  const isPurchase = direction === "purchase";
  const [lines, setLines] = useState<ReceiptLine[]>([blankLine("initial", initialItemId)]);
  const [status, setStatus] = useState<{ tone: "good" | "bad"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const updateLine = (key: string, update: Partial<ReceiptLine>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...update } : line));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!lines.every((line) => line.itemId && line.quantity > 0 && line.totalSeptims >= 0)) {
      setStatus({ tone: "bad", message: "Select an item and enter a valid quantity and total for every line." });
      return;
    }
    setSubmitting(true); setStatus(null);
    const form = new FormData(formElement);
    const response = await fetch("/api/v1/receipts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeId, direction: isPurchase ? "store_purchase" : "store_sale", notes: String(form.get("notes") || "") || undefined, lines: lines.map(({ itemId, quantity, totalSeptims }) => ({ itemId, quantity, totalSeptims })) })
    });
    const payload = await response.json().catch(() => ({})) as { status?: string; error?: string };
    setSubmitting(false);
    if (response.ok) {
      if (returnTo) {
        router.replace(completedReturn(returnTo, payload.status === "pending") as Route);
        return;
      }
      formElement.reset();
      setLines([blankLine(crypto.randomUUID())]);
      setStatus({ tone: "good", message: `${isPurchase ? "Purchase" : "Sale"} ${payload.status === "pending" ? "submitted for approval" : "recorded"}.` });
      return;
    }
    setStatus({ tone: "bad", message: payload.error === "invalid_receipt" ? "Review the receipt lines and try again." : "The receipt could not be recorded." });
  }

  return <form className="panel" onSubmit={submit}>
    <div className="notice"><b>{isPurchase ? "Store purchase" : "Store sale"}</b><span>SkyStore records your account and the current time automatically.</span></div>
    <div className="span-all"><p className="eyebrow">ITEMS</p>{lines.map((line) => <div className="receipt-line" key={line.key}>
      <Field label="Item"><CatalogPicker value={line.itemId} onChange={(itemId) => updateLine(line.key, { itemId })}/></Field>
      <Field label="Quantity"><input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })} required /></Field>
      <Field label={isPurchase ? "Store paid (g)" : "Customer paid (g)"}><input type="number" min="0" value={line.totalSeptims} onChange={(event) => updateLine(line.key, { totalSeptims: Number(event.target.value) })} required /></Field>
      <button className="outline" type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((candidate) => candidate.key !== line.key))}>Remove</button>
    </div>)}<button className="text-button" type="button" onClick={() => setLines((current) => [...current, blankLine(crypto.randomUUID())])}>+ Add another item</button></div>
    <details style={{ marginTop: 16 }}><summary>Add a note</summary><Field label="Note"><textarea name="notes" placeholder="Optional store-private note" /></Field></details>
    <div className="button-row" style={{ marginTop: 16 }}><button className="button" type="submit" disabled={submitting}>{submitting ? "Recording…" : isPurchase ? "Record purchase" : "Record sale"}</button></div>
    <SubmissionStatus status={status} />
    <p className="fine">Verified clerks publish immediately. Other submissions remain provisional until another verified member approves them.</p>
  </form>;
}

export function ObservationForm({ storeId, initialItemId = "", returnTo }: { storeId: string; initialItemId?: string; returnTo?: string }) {
  const router = useRouter();
  const [itemId, setItemId] = useState(initialItemId);
  const [pickerKey, setPickerKey] = useState("initial");
  const [status, setStatus] = useState<{ tone: "good" | "bad"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSubmitting(true); setStatus(null);
    const response = await fetch("/api/v1/observations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeId, itemId, quantity: Number(form.get("quantity")), totalSeptims: Number(form.get("totalSeptims")) })
    });
    const payload = await response.json().catch(() => ({})) as { approval?: string; error?: string };
    setSubmitting(false);
    if (response.ok) {
      if (returnTo) {
        router.replace(completedReturn(returnTo, payload.approval === "pending") as Route);
        return;
      }
      formElement.reset(); setItemId(""); setPickerKey(crypto.randomUUID());
      setStatus({ tone: "good", message: `Street price ${payload.approval === "pending" ? "submitted for approval" : "recorded"}.` });
      return;
    }
    setStatus({ tone: "bad", message: payload.error === "invalid_observation" ? "Select an item and enter a valid quantity and total." : "The street price could not be recorded." });
  }

  return <form className="panel" onSubmit={submit}>
    <div className="notice"><b>Street price</b><span>Recorded automatically as the traded value at the current time.</span></div>
    <div className="grid receipt-line">
      <Field label="Item"><CatalogPicker key={pickerKey} value={itemId} onChange={setItemId}/></Field>
      <Field label="Quantity"><input name="quantity" type="number" min="1" defaultValue="1" required /></Field>
      <Field label="Total price (g)"><input name="totalSeptims" type="number" min="0" required /></Field>
      <button className="button" type="submit" disabled={submitting || !itemId}>{submitting ? "Recording…" : "Record street price"}</button>
    </div>
    <SubmissionStatus status={status} />
    <p className="fine">Street prices never change stock. Verified clerks publish immediately; other submissions go to the approval queue.</p>
  </form>;
}
