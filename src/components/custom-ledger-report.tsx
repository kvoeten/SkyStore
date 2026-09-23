"use client";

import { useState } from "react";

export function CustomLedgerReport() {
  const [message, setMessage] = useState<string | null>(null);
  async function submit(form: HTMLFormElement) {
    setMessage("Saving ledger for review…");
    const response = await fetch("/api/v1/market/ledger-submissions", { method: "POST", body: new FormData(form) });
    if (!response.ok) { setMessage("The ledger could not be saved. Use a Google Drive link, plain text, or a PDF, Word, Excel, CSV, or text file up to 20 MB."); return; }
    form.reset(); setMessage("Ledger saved for the administrator’s to-do list. It will not affect market prices until reviewed.");
  }
  return <section className="panel"><div className="panel-head"><div><p className="eyebrow">CUSTOM LEDGER</p><h2>Send a price sheet for review</h2></div></div><p>Drop a source ledger here instead of manually reporting every line. It is stored privately for the administrator to incorporate later.</p><form className="stack" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}><label className="field"><span>Google Drive or public source link</span><input type="url" name="sourceUrl" placeholder="https://docs.google.com/..."/></label><label className="field"><span>Upload a file</span><input type="file" name="file" accept=".csv,.tsv,.xlsx,.xls,.pdf,.doc,.docx,.txt"/></label><label className="field"><span>Or paste a table</span><textarea name="plaintext" placeholder="Item | value | region&#10;Iron Ore | 0.2 | Whiterun"/></label><button className="button" type="submit">Save for review</button>{message && <p className="notice" role="status">{message}</p>}</form></section>;
}
