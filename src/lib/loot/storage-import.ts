export const STORAGE_CONTAINERS = { event: "000C83B1", store: "000C83E9" } as const;
export const isIgnoredStorageItem = (name: string, plugin = "", formId = "") => /^KzlChestLootBook$/i.test(name.trim()) || (plugin.toLowerCase() === "keizaal.esp" && formId.toUpperCase().slice(-6) === "DC4E14");
export type StorageKind = keyof typeof STORAGE_CONTAINERS;
export type StorageItem = {
  key: string; name: string; quantity: number; plugin: string; formId: string;
  customName: string; temper: string; category: string; unitValue: number | null;
};
export type StorageSnapshot = {
  kind: StorageKind; containerId: string; capturedAt: string; session: string; items: StorageItem[];
};

/** RFC4180 fields, including quoted commas, quotes and embedded newlines. */
export function readStorageCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, endedQuote = false;
  const source = input.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') { quoted = false; endedQuote = true; }
      else field += char;
    } else if (char === '"' && field === "" && !endedQuote) quoted = true;
    else if (char === ",") { row.push(field); field = ""; endedQuote = false; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = []; field = ""; endedQuote = false;
    } else {
      if (endedQuote || char === '"') throw new Error("Malformed CSV quoting.");
      field += char;
    }
  }
  if (quoted) throw new Error("Incomplete CSV: a quoted field is unfinished.");
  if (field !== "" || row.length) { row.push(field); if (row.some(Boolean)) rows.push(row); }
  return rows;
}

/** Select a single latest snapshot, never accumulate repeated captures. */
export function importStorageCsv(csv: string, kind: StorageKind): StorageSnapshot {
  if (csv.length > 20_000_000) throw new Error("Storage CSV exceeds 20 MB.");
  const [header, ...rows] = readStorageCsv(csv);
  const required = ["container_id", "name", "count", "form_id", "source_plugin", "captured_utc", "session"];
  if (!header || required.some((key) => !header.includes(key)) || new Set(header).size !== header.length) throw new Error("Not a supported inventory CSV.");
  const records = rows.map((row) => {
    if (row.length !== header.length) throw new Error("Incomplete CSV row. Export a complete snapshot again.");
    return Object.fromEntries(header.map((key, index) => [key, row[index]]));
  }).filter((row) => row.container_id.toUpperCase() === STORAGE_CONTAINERS[kind]);
  if (!records.length) throw new Error(`CSV contains no ${kind} storage snapshot.`);
  for (const row of records) {
    if (!Number.isFinite(Date.parse(row.captured_utc)) || !row.session) throw new Error("Snapshot timestamp or session is invalid.");
  }
  const latest = records.reduce((best, row) => Date.parse(row.captured_utc) > Date.parse(best.captured_utc) ? row : best);
  const selected = records.filter((row) => row.captured_utc === latest.captured_utc && row.session === latest.session);
  const items = new Map<string, StorageItem>();
  for (const row of selected) {
    if (isIgnoredStorageItem(row.name, row.source_plugin, row.form_id) || isIgnoredStorageItem(row.custom_name ?? "")) continue;
    const quantity = Number(row.count);
    if (!/^\d+$/.test(row.count) || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1_000_000) throw new Error(`Invalid quantity: ${row.name}`);
    if (!/^[a-f\d]{8}$/i.test(row.form_id) || !row.source_plugin) throw new Error("Item identity is missing.");
    if (!quantity) continue;
    const plugin = row.source_plugin.toLowerCase(), formId = row.form_id.toUpperCase();
    const customName = row.custom_name ?? "", temper = row.temper_health ?? "";
    // Runtime load-order prefixes may change while plugin-local identity stays.
    const localFormId = formId.startsWith("FE") ? formId.slice(-3) : formId.slice(-6);
    const key = JSON.stringify([plugin, localFormId, row.name, customName, temper]);
    const existing = items.get(key);
    if (existing) {
      existing.quantity += quantity;
      if (!Number.isSafeInteger(existing.quantity) || existing.quantity > 1_000_000) throw new Error("Stock quantity exceeds limit.");
    } else items.set(key, { key, plugin, formId, customName, temper, name: customName || row.name || formId, quantity, category: "Review", unitValue: null });
  }
  return { kind, containerId: STORAGE_CONTAINERS[kind], capturedAt: new Date(latest.captured_utc).toISOString(), session: latest.session, items: [...items.values()] };
}
