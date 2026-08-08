"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApprovalActions({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  async function decide(decision: "approved" | "rejected") {
    setBusy(decision); setError(null);
    try {
      const response = await fetch(`/api/v1/approvals/${approvalId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error ?? "Could not record this decision."); }
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record this decision."); }
    finally { setBusy(null); }
  }
  return <span className="button-row"><button className="button" type="button" disabled={busy !== null} onClick={() => decide("approved")}>{busy === "approved" ? "Approving…" : "Approve"}</button><button className="outline" type="button" disabled={busy !== null} onClick={() => decide("rejected")}>{busy === "rejected" ? "Rejecting…" : "Reject"}</button>{error && <small className="negative" role="alert">{error}</small>}</span>;
}
