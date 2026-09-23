type CatalogName = { name?: string | null; displayName?: string | null; editorId?: string | null };

/**
 * Keeps incomplete, mojibake, and known debug records out of player-facing
 * market discovery without deleting them from the imported catalog.
 */
export function isMarketItemDisplayable(item: CatalogName): boolean {
  const name = (item.displayName ?? item.name ?? "").trim();
  const editorId = (item.editorId ?? "").trim();
  if (!name || name === "—" || name.includes("�")) return false;
  if (name.includes("Ã") || name.includes("Â")) return false;
  if (/^<[^>]+>$/u.test(name) || /^<Alias=/iu.test(name)) return false;
  if (/^(?:dummy|test|debug)/iu.test(name)) return false;
  if (/^\d+\s+abc def ghi/iu.test(name)) return false;
  if (/^(?:qa|dummy|test|debug)/iu.test(editorId)) return false;
  if (/^dlc\d+/iu.test(name)) return false;
  return true;
}
