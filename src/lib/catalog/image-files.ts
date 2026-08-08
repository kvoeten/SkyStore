import { basename, extname, resolve } from "node:path";

export const CATALOG_IMAGE_ROOT = "/var/lib/skystore/catalog-images/renders";

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

export function resolveCatalogImage(
  segments: readonly string[] | undefined,
  root = CATALOG_IMAGE_ROOT
): { filePath: string; contentType: string } | null {
  if (!segments || segments.length !== 1) return null;
  const name = segments[0];
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\") || basename(name) !== name) return null;

  const contentType = CONTENT_TYPES[extname(name).toLowerCase()];
  if (!contentType) return null;

  const resolvedRoot = resolve(root);
  const filePath = resolve(resolvedRoot, name);
  if (filePath !== resolve(resolvedRoot, basename(name))) return null;
  return { filePath, contentType };
}
