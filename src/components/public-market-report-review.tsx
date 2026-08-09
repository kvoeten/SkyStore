"use client";

import { useEffect, useState } from "react";
import { formatGold } from "@/lib/money";

type Report = {
  id: string;
  itemName: string;
  quantity: number;
  totalSeptims: number;
  locationType: "store_sale" | "street_sale";
  note?: string | null;
  contributorDisplayName: string;
  contributorDiscordName?: string | null;
  contributorDiscordId?: string | null;
  createdAt: string;
};

export function PublicMarketReportReview() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => fetch("/api/v1/platform/market-reports?status=pending")
    .then(async (response) => response.ok ? response.json() as Promise<{ reports: Report[] }> : Promise.reject(new Error("queue unavailable")))
    .then((payload) => setReports(payload.reports)).catch(() => setReports([]));
  useEffect(() => { void load(); }, []);
  async function review(id: string, decision: "approved" | "rejected") {
    setBusy(id); setMessage(null);
    const response = await fetch(`/api/v1/platform/market-reports/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) });
    setBusy(null);
    if (!response.ok) { setMessage("The report could not be reviewed."); return; }
    setMessage(decision === "approved" ? "Report approved for market analysis." : "Report rejected.");
    void load();
  }
  return <section className="panel" style={{ marginTop: 20 }}>
    <div className="panel-head"><div><p className="eyebrow">PUBLIC CONTRIBUTIONS</p><h2>Market report review</h2></div><span className="status pending">{reports ? `${reports.length} pending` : "Loading…"}</span></div>
    <p className="fine">These reports do not affect stock. Approved store-sale reports become delayed public price evidence; street-sale reports remain available only in signed-in street pricing.</p>
    {reports?.length ? <ul className="list">{reports.map((report) => <li key={report.id}>
      <span><b>{report.itemName}</b><br/><small>{formatGold(report.totalSeptims / report.quantity)} · {report.quantity} units · {formatGold(report.totalSeptims)} total · {report.locationType === "store_sale" ? "Store sale" : "Street sale"}</small><br/><small>{report.contributorDisplayName}{report.contributorDiscordName ? ` · Discord: ${report.contributorDiscordName}${report.contributorDiscordId ? ` (${report.contributorDiscordId})` : ""}` : " · Anonymous submission"} · {new Date(report.createdAt).toLocaleString()}</small>{report.note ? <><br/><small>{report.note}</small></> : null}</span>
      <span className="button-row"><button className="outline" type="button" disabled={busy === report.id} onClick={() => review(report.id, "rejected")}>Reject</button><button className="button" type="button" disabled={busy === report.id} onClick={() => review(report.id, "approved")}>Approve</button></span>
    </li>)}</ul> : reports ? <div className="empty"><h3>No public reports pending.</h3><p>New public reports will appear here for platform review.</p></div> : <p>Loading reports…</p>}
    {message ? <p className="notice">{message}</p> : null}
  </section>;
}
