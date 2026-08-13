export type FamilyCandidate = {
  id: string;
  name: string;
  recordType?: string | null;
  category?: string | null;
  craftSignature?: string | null;
};

const numberedSuffix = /(?:\s+(?:variant\s*)?#?\d+|\s*\(\s*\d+\s*\))$/i;
const copySuffix = /\s+(?:copy|duplicate)(?:\s+\d+)?$/i;

export function itemFamilyBaseName(name: string): string {
  let normalized = name.trim().replace(/\s+/g, " ");
  let previous = "";
  while (previous !== normalized) {
    previous = normalized;
    normalized = normalized.replace(numberedSuffix, "").replace(copySuffix, "").trim();
  }
  return normalized || name.trim();
}

export function itemFamilyKey(item: FamilyCandidate): string {
  const base = itemFamilyBaseName(item.name).toLocaleLowerCase("en-US");
  // Craftable variants only share a market identity when the material recipe is
  // identical. Non-craftable records are intentionally collapsed more
  // aggressively by their cleaned name, even when mods model the same object
  // with different Skyrim record types.
  return item.craftSignature
    ? `craft:${base}:${item.craftSignature}`
    : `plain:${base}`;
}

export function collapseItemFamilies<T extends FamilyCandidate>(items: T[]): Array<T & { familyItemIds: string[]; familyName: string }> {
  const grouped = new Map<string, T[]>();
  for (const item of items) grouped.set(itemFamilyKey(item), [...(grouped.get(itemFamilyKey(item)) ?? []), item]);
  return [...grouped.values()].map((family) => {
    const sorted = family.slice().sort((left, right) => canonicalScore(left) - canonicalScore(right) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
    return { ...sorted[0], familyItemIds: sorted.map((item) => item.id), familyName: itemFamilyBaseName(sorted[0].name) };
  });
}

function canonicalScore(item: FamilyCandidate) {
  return item.name === itemFamilyBaseName(item.name) ? 0 : 1;
}
