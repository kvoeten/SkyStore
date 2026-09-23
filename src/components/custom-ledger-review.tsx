"use client";

import { useEffect, useState } from "react";

type Submission = { id: string; contributorDisplayName: string; sourceUrl?: string | null; plaintext?: string | null; fileName?: string | null; mimeType?: string | null; fileSize?: number | null; status: string; adminNote?: string | null; createdAt: string };

export function CustomLedgerReview() {
  const [items, setItems] = useState<Submission[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = () => fetch("/api/v1/market/ledger-submissions").then((response) => response.ok ? response.json() : Promise.reject()).then((payload: { submissions?: Submission[] }) => setItems(payload.submissions ?? [])).catch(() => setItems([]));
  useEffect(() => { void load(); }, []);
  async function review(id: string, status: "approved" | "rejected") { const response = await fetch("/api/v1/market/ledger-submissions", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) }); setMessage(response.ok ? "Ledger to-do updated." : "Could not update ledger to-do."); if (response.ok) void load(); }
  const pending = items?.filter((item) => item.status === "pending") ?? [];
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">ADMIN TO-DO</p><h2>Custom ledgers</h2></div><span className="pill pending">{items === null ? "…" : `${pending.length} waiting`}</span></div>{items === null ? <p>Loading ledgers…</p> : pending.length ? <ul className="list">{pending.map((item) => <li key={item.id}><span><b>{item.fileName ?? (item.sourceUrl ? "Linked ledger" : "Pasted table")}</b><br/><small>{item.contributorDisplayName} · {new Date(item.createdAt).toLocaleString()}</small>{item.sourceUrl && <><br/><a className="text-button" href={item.sourceUrl} target="_blank" rel="noreferrer">Open source</a></>}{item.plaintext && <><br/><small>{item.plaintext.slice(0, 220)}{item.plaintext.length > 220 ? "…" : ""}</small></>}</span><span className="button-row"><button className="outline" onClick={() => void review(item.id, "approved")}>Mark incorporated</button><button className="text-button" onClick={() => void review(item.id, "rejected")}>Dismiss</button></span></li>)}</ul> : <div className="empty compact-empty"><h3>No custom ledgers waiting.</h3><p>Uploaded sheets and pasted tables will appear here.</p></div>}{message && <p className="notice">{message}</p>}</section>;
}
