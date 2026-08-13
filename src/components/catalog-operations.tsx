"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/forms";
import { Status } from "@/components/app-shell";
import type { CatalogVersionAdminView } from "@/lib/catalog/admin-data";
import { ItemCategoryManager } from "@/components/item-category-manager";

const iconOptions = [
  ["/catalog-icons/misc.png", "Miscellaneous & materials"],
  ["/catalog-icons/potion.png", "Potions & alchemy"], ["/catalog-icons/food.png", "Food & drink"], ["/catalog-icons/weapon.png", "Weapons & ammunition"],
  ["/catalog-icons/armor.png", "Armor, clothing & jewelry"], ["/catalog-icons/book.png", "Books & scrolls"]
] as const;

type Message = { tone: "good" | "bad"; text: string } | null;

export function CatalogOperations({ versions }: { versions: CatalogVersionAdminView[] }) {
  const router = useRouter();
  const [importMessage, setImportMessage] = useState<Message>(null);
  const [manualMessage, setManualMessage] = useState<Message>(null);
  const [busyVersion, setBusyVersion] = useState<string | null>(null);

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/catalog/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileName: String(form.get("fileName")) }) });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      event.currentTarget.reset();
      setImportMessage({ tone: "good", text: `${payload.importedItemCount.toLocaleString()} items staged in ${payload.version}.` });
      router.refresh();
    } else {
      setImportMessage({ tone: "bad", text: payload.detail ?? payload.error ?? "The catalog bundle could not be staged." });
    }
  }

  async function activate(version: string) {
    setBusyVersion(version);
    const response = await fetch("/api/v1/catalog/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version }) });
    const payload = await response.json().catch(() => ({}));
    setBusyVersion(null);
    setImportMessage(response.ok
      ? { tone: "good", text: `${version} is now the active catalog version.` }
      : { tone: "bad", text: payload.detail ?? payload.error ?? "Catalog activation failed." });
    if (response.ok) router.refresh();
  }

  async function createManualItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const aliases = String(form.get("aliases") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    const response = await fetch("/api/v1/catalog/manual-items", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: String(form.get("name")), category: String(form.get("category")), fallbackIcon: String(form.get("fallbackIcon")), editorId: String(form.get("editorId") ?? "") || undefined, aliases })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      event.currentTarget.reset();
      const skipped = payload.aliasesSkipped?.length ? ` ${payload.aliasesSkipped.length} conflicting alias(es) were left unchanged.` : "";
      setManualMessage({ tone: "good", text: `Custom item created.${skipped}` });
      router.refresh();
    } else {
      setManualMessage({ tone: "bad", text: payload.error ?? "The custom item could not be created." });
    }
  }

  const issueRows = versions.flatMap((version) => (version.report?.issues ?? []).map((issue) => ({ version: version.version, ...issue })));
  return <>
    <div className="grid two-col">
      <section className="panel">
        <p className="eyebrow">SERVER-SIDE IMPORT</p>
        <h2>Stage a catalog bundle</h2>
        <p className="fine">Place the builder JSON inside the administrator-controlled catalog-import volume first. The browser sends only its relative filename.</p>
        <form onSubmit={submitImport}>
          <Field label="Bundle filename"><input name="fileName" required pattern=".+\.json" placeholder="skystore-catalog-current.json" autoComplete="off" /></Field>
          <button className="button" type="submit">Validate &amp; stage bundle</button>
        </form>
        <MessageLine message={importMessage} />
      </section>
      <form className="panel" onSubmit={createManualItem}>
        <p className="eyebrow">CUSTOM ITEM</p>
        <h2>Create manual catalog record</h2>
        <Field label="Name"><input name="name" required placeholder="Required item name" /></Field>
        <Field label="Commerce category"><input name="category" required placeholder="For example: Crafting materials" /></Field>
        <Field label="Category fallback icon"><select name="fallbackIcon" defaultValue="/catalog-icons/misc.png">{iconOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Editor ID (optional)"><input name="editorId" placeholder="CustomMerchantItem01" /></Field>
        <Field label="Aliases (optional, comma-separated)"><input name="aliases" placeholder="Common name, old name" /></Field>
        <button className="outline" type="submit">Create active custom item</button>
        <MessageLine message={manualMessage} />
      </form>
    </div>

    <section className="panel" style={{ marginTop: 20 }}>
      <p className="eyebrow">VERSIONED CATALOG BUNDLES</p>
      <h2>Staged and active versions</h2>
      {versions.length === 0 ? <div className="empty"><b>No catalog bundle has been imported.</b><p className="fine">Run the offline Keizaal builder, place its JSON in the import volume, then stage it above.</p></div> : <ul className="list">{versions.map((version) => <li key={version.id}>
        <span><b>{version.version}</b><br/><small>{version.report ? `${version.report.importedItemCount.toLocaleString()} items · ${version.report.importedImageCount.toLocaleString()} images` : "No staging report recorded"} · load order {shortHash(version.sourceLoadOrderHash)} · staged {formatDate(version.createdAt)}</small></span>
        <span className="button-row"><Status kind={version.status === "active" ? "good" : version.status === "staged" ? "pending" : "warn"}>{version.status}</Status>{version.status === "staged" && <button className="outline" type="button" disabled={busyVersion === version.version || Boolean(version.report?.blockingIssueCount)} onClick={() => activate(version.version)}>{busyVersion === version.version ? "Activating…" : version.report?.blockingIssueCount ? "Resolve mappings first" : "Activate"}</button>}</span>
      </li>)}</ul>}
    </section>

    <section className="panel" style={{ marginTop: 20 }}>
      <p className="eyebrow">UNRESOLVED MAPPINGS</p>
      <h2>Review import findings</h2>
      {issueRows.length === 0 ? <div className="notice success"><b>No unresolved mappings.</b><span>There are no recorded import issues for the current staged or active versions.</span></div> : <ul className="list">{issueRows.map((issue, index) => <li key={`${issue.version}:${issue.stableKey}:${issue.code}:${index}`}><span><b>{issue.stableKey}</b><br/><small>{issue.version} · {issue.detail}</small></span><Status kind={issue.blocking ? "warn" : "pending"}>{issue.blocking ? "Blocks activation" : "Fallback retained"}</Status></li>)}</ul>}
      <p className="fine">Ambiguous aliases are withheld. Unresolved artwork uses its catalog category fallback. Historic items are preserved; no receipt or stock reference is deleted during activation.</p>
    </section>
    <ItemCategoryManager />
  </>;
}

function MessageLine({ message }: { message: Message }) {
  if (!message) return null;
  return <p className={message.tone === "good" ? "positive status" : "negative status"} role="status">{message.text}</p>;
}

function shortHash(value: string) { return value.length > 12 ? `${value.slice(0, 12)}…` : value; }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
