import { categoryIconPath } from "./category-icons";

export type UespIconEntry = {
  title: string;
  canonicalTitle: string;
  sourcePageUrl: string;
  originalUrl: string;
  sha1: string;
  mime: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  timestamp: string | null;
  categoryTrail: string[];
  localPath: string;
};

export type UespCatalogItem = {
  stableKey: string;
  name: string;
  editorId?: string | null;
  formId?: string | null;
  category: string;
  aliases?: string[];
  modelPath?: string | null;
};

export type UespIconMapping = {
  stableKey: string;
  localPath: string;
  kind: "exact" | "category_fallback";
  provider: "uesp" | "skystore_category_art";
  matchedBy: "display_name" | "editor_id" | "form_id" | "alias" | "model_path_exact" | "category_fallback";
  icon: Pick<UespIconEntry, "title" | "canonicalTitle" | "sourcePageUrl" | "originalUrl" | "sha1" | "mime" | "width" | "height" | "bytes" | "timestamp" | "categoryTrail">;
};

const ignored = new Set(["a", "an", "the", "of", "and", "for", "to", "with", "skyrim", "icon", "icons", "item", "items"]);

export function normalizeIconIdentity(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u2019'`]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/\.(?:png|jpe?g|webp|gif|svg)$/i, "")
    .replace(/^file:/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((part) => !ignored.has(part))
    .join(" ");
}

function tokens(value: string): string[] {
  return normalizeIconIdentity(value).split(" ").filter(Boolean);
}

function iconText(icon: UespIconEntry): string {
  return [icon.title, icon.canonicalTitle, ...icon.categoryTrail].join(" ");
}

function isCategoryCompatible(item: UespCatalogItem, icon: UespIconEntry): boolean {
  const text = normalizeIconIdentity(iconText(icon));
  const category = normalizeIconIdentity(item.category);
  const incompatible = incompatibleKeywords(category);
  if (incompatible.some((term) => text.includes(term))) return false;
  return true;
}

function isExplicitlyCategoryCompatible(item: UespCatalogItem, icon: UespIconEntry): boolean {
  if (!isCategoryCompatible(item, icon)) return false;
  const text = normalizeIconIdentity(iconText(icon));
  return categoryKeywords(item.category).some((term) => text.includes(term));
}

export function categoryKeywords(category: string): string[] {
  const value = normalizeIconIdentity(category);
  if (/(weapon|ammunition)/.test(value)) return ["weapon", "sword", "axe", "mace", "bow", "arrow", "bolt", "dagger", "warhammer", "staff"];
  if (/(armor|clothing|apparel)/.test(value)) return ["armor", "armour", "clothing", "clothes", "robe", "boot", "helmet", "gauntlet", "shield"];
  if (/(alchemy|ingredient|flora)/.test(value)) return ["ingredient", "alchemy", "flower", "plant", "mushroom", "food"];
  if (/(potion|poison)/.test(value)) return ["potion", "poison", "bottle"];
  if (/(food|drink)/.test(value)) return ["food", "drink", "meat", "bread", "vegetable", "fruit"];
  if (/(ore|ingot|mineral|crafting material)/.test(value)) return ["ore", "ingot", "mineral", "metal", "material"];
  if (/(jewel|gem)/.test(value)) return ["jewelry", "jewellery", "ring", "necklace", "gem"];
  if (/(book|scroll|spell)/.test(value)) return ["book", "scroll", "tome", "spell"];
  if (/(soul gem)/.test(value)) return ["soul", "gem"];
  if (/(hide|leather|pelt)/.test(value)) return ["hide", "leather", "pelt", "fur"];
  if (/(key|lockpick)/.test(value)) return ["key", "lockpick"];
  return ["misc", "item", "items"];
}

function incompatibleKeywords(category: string): string[] {
  const value = normalizeIconIdentity(category);
  if (/(weapon|ammunition)/.test(value)) return ["potion", "food", "armor", "clothing", "book"];
  if (/(armor|clothing|apparel)/.test(value)) return ["potion", "food", "weapon", "book"];
  if (/(alchemy|ingredient|flora)/.test(value)) return ["weapon", "armor", "book"];
  if (/(potion|poison)/.test(value)) return ["weapon", "armor", "book"];
  if (/(book|scroll|spell)/.test(value)) return ["potion", "weapon", "armor"];
  return [];
}

function categoryScore(item: UespCatalogItem, icon: UespIconEntry): number {
  const text = normalizeIconIdentity(iconText(icon));
  const terms = categoryKeywords(item.category);
  const hits = terms.filter((term) => text.includes(term)).length;
  return hits * 100 + Math.min(icon.width ?? 0, 512) / 100 + Math.min(icon.height ?? 0, 512) / 100;
}

function stableIconOrder(left: UespIconEntry, right: UespIconEntry): number {
  return left.canonicalTitle.localeCompare(right.canonicalTitle) || left.localPath.localeCompare(right.localPath);
}

const iconPrefixTokens = new Set(["sr", "srmod", "armor", "clothing", "weapon", "ammunition", "ammo", "ingredient", "alchemy", "food", "drink", "potion", "poison", "book", "scroll", "jewelry", "jewellery", "misc", "soulgem"]);

function normalizeIconSubject(icon: UespIconEntry): string {
  const parts = [...tokens(icon.title)];
  while (parts.length && iconPrefixTokens.has(parts[0]!)) parts.shift();
  while (parts.length && (/^(?:m|f|male|female)$/.test(parts.at(-1)!) || /^xx[0-9a-f]{6}$/i.test(parts.at(-1)!))) parts.pop();
  return parts.join(" ");
}

function isExactItemSubject(item: UespCatalogItem, icon: UespIconEntry): boolean {
  return normalizeIconIdentity(item.name) === normalizeIconSubject(icon);
}

function iconProjection(icon: UespIconEntry): UespIconMapping["icon"] {
  const { title, canonicalTitle, sourcePageUrl, originalUrl, sha1, mime, width, height, bytes, timestamp, categoryTrail } = icon;
  return { title, canonicalTitle, sourcePageUrl, originalUrl, sha1, mime, width, height, bytes, timestamp, categoryTrail };
}

/**
 * Selects an item-specific UESP file before using original SkyStore category artwork. The outcome is
 * entirely ordered by stable catalog key/title; it never depends on API pagination order.
 */
export function mapCatalogIcons(items: UespCatalogItem[], icons: UespIconEntry[], categoryFallbacks: UespIconEntry[] = []): UespIconMapping[] {
  const usable = icons.filter((icon) => icon.localPath.startsWith("/") && icon.sha1 && isCategoryCompatible({ stableKey: "", name: "", category: "" }, icon)).sort(stableIconOrder);
  if (!usable.length && !categoryFallbacks.length) throw new Error("No downloaded UESP icons or SkyStore category artwork are available for mapping.");

  const preparedIcons = usable.map((icon) => ({ icon, subject: normalizeIconSubject(icon) }));
  const iconsBySubject = new Map<string, typeof preparedIcons>();
  for (const prepared of preparedIcons) {
    if (!prepared.subject) continue;
    const bucket = iconsBySubject.get(prepared.subject);
    if (bucket) bucket.push(prepared);
    else iconsBySubject.set(prepared.subject, [prepared]);
  }

  const orderedItems = [...items].sort((left, right) => left.stableKey.localeCompare(right.stableKey));
  const direct = new Map<string, { icon: UespIconEntry; matchedBy: UespIconMapping["matchedBy"] }>();
  for (const item of orderedItems) {
      const candidates: Array<{ identity: string; matchedBy: UespIconMapping["matchedBy"] }> = [
        { identity: item.name, matchedBy: "display_name" },
        ...(item.editorId ? [{ identity: item.editorId, matchedBy: "editor_id" as const }] : []),
        ...(item.formId ? [{ identity: item.formId, matchedBy: "form_id" as const }] : []),
        ...(item.aliases ?? []).map((identity) => ({ identity, matchedBy: "alias" as const }))
      ];
      let selected: { icon: UespIconEntry; score: number; matchedBy: UespIconMapping["matchedBy"] } | null = null;
      for (const candidate of candidates) {
        const target = normalizeIconIdentity(candidate.identity);
        if (!target) continue;
        const candidatePool = iconsBySubject.get(target) ?? [];
        for (const prepared of candidatePool) {
          const icon = prepared.icon;
          if (!isExplicitlyCategoryCompatible(item, icon)) continue;
          const score = 10_000 + categoryScore(item, icon);
          if (!selected || score > selected.score || (score === selected.score && stableIconOrder(icon, selected.icon) < 0)) selected = { icon, score, matchedBy: candidate.matchedBy };
        }
      }
      if (selected) direct.set(item.stableKey, { icon: selected.icon, matchedBy: selected.matchedBy });
  }

  // Name matches are allowed to teach an identical NIF model one icon. This is deliberately
  // exact-only: no fuzzy title, plugin, or shared-editor-ID inference can cross this boundary.
  const iconByModel = new Map<string, UespIconEntry>();
  const ambiguousModels = new Set<string>();
  for (const item of orderedItems) {
    const match = direct.get(item.stableKey);
    const normalizedModel = normalizeIconIdentity(item.modelPath);
    if (!match || !normalizedModel || match.matchedBy !== "display_name") continue;
    if (!isExactItemSubject(item, match.icon)) continue;
    const existing = iconByModel.get(normalizedModel);
    if (existing && existing.localPath !== match.icon.localPath) ambiguousModels.add(normalizedModel);
    else iconByModel.set(normalizedModel, match.icon);
  }
  for (const model of ambiguousModels) iconByModel.delete(model);

  return orderedItems.map((item) => {
      const directMatch = direct.get(item.stableKey);
      if (directMatch) return { stableKey: item.stableKey, localPath: directMatch.icon.localPath, kind: "exact" as const, provider: "uesp" as const, matchedBy: directMatch.matchedBy, icon: iconProjection(directMatch.icon) };
      const modelIcon = item.modelPath ? iconByModel.get(normalizeIconIdentity(item.modelPath)) : undefined;
      if (modelIcon && isExplicitlyCategoryCompatible(item, modelIcon)) return { stableKey: item.stableKey, localPath: modelIcon.localPath, kind: "exact" as const, provider: "uesp" as const, matchedBy: "model_path_exact" as const, icon: iconProjection(modelIcon) };

      const expectedFallback = categoryIconPath(item);
      const fallback = categoryFallbacks.find((icon) => icon.localPath === expectedFallback);
      if (!fallback) throw new Error(`No local SkyStore category artwork exists for ${item.stableKey} (${item.category}). Generate the category fallback manifest before mapping.`);
      return { stableKey: item.stableKey, localPath: fallback.localPath, kind: "category_fallback" as const, provider: "skystore_category_art" as const, matchedBy: "category_fallback" as const, icon: iconProjection(fallback) };
    });
}
