import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { UespIconEntry } from "@/lib/catalog/uesp-icon-map";

const API = "https://en.uesp.net/w/api.php";
const USER_AGENT = "SkyStore/0.1 offline icon importer (contact: SkyStore administrator; polite 1 req/s)";
const DEFAULT_OUTPUT = "catalog/generated/uesp-icons";
const MANIFEST_NAME = "uesp-icons-manifest.json";

type CategoryMember = { pageid: number; ns: number; title: string };
type ImageInfo = { url?: string; thumburl?: string; descriptionurl?: string; sha1?: string; mime?: string; size?: number; width?: number; height?: number; thumbwidth?: number; thumbheight?: number; timestamp?: string };
type UnavailableFile = { title: string; sourcePageUrl: string; originalUrl: string; reason: string };
type Manifest = { schemaVersion: "1"; source: { wiki: string; rootCategory: string; fetchedAt: string; userAgent: string }; files: UespIconEntry[]; incomplete?: boolean; unavailable?: UnavailableFile[] };
type MediaWikiResponse = { query?: { categorymembers?: CategoryMember[]; pages?: Array<{ title: string; imageinfo?: ImageInfo[] }> }; continue?: { cmcontinue?: string } };

function argument(name: string, fallback?: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : process.argv[at + 1];
}
function flag(name: string): boolean { return process.argv.includes(name); }
function positive(name: string, fallback: number): number {
  const raw = argument(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}
function safeFilename(title: string, url: string): string {
  const suffix = extname(new URL(url).pathname).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin";
  const slug = title.replace(/^File:/i, "").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 110) || "uesp-icon";
  return `${slug}-${createHash("sha1").update(`${title}\n${url}`).digest("hex").slice(0, 12)}${suffix}`;
}
function sourcePageUrl(title: string): string { return `https://en.uesp.net/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`; }
async function pause(ms: number) { await new Promise((resolve) => setTimeout(resolve, ms)); }

let lastRequestAt = 0;
async function api(params: Record<string, string>): Promise<MediaWikiResponse> {
  const minimumGapMs = 1_050;
  const wait = Math.max(0, lastRequestAt + minimumGapMs - Date.now());
  if (wait) await pause(wait);
  const url = new URL(API);
  for (const [key, value] of Object.entries({ format: "json", formatversion: "2", origin: "*", ...params })) url.searchParams.set(key, value);
  lastRequestAt = Date.now();
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`UESP API ${response.status} for ${url.searchParams.get("action")}`);
  return await response.json() as MediaWikiResponse;
}

async function categoryMembers(category: string): Promise<CategoryMember[]> {
  const result: CategoryMember[] = [];
  let continuation: string | undefined;
  do {
    const json = await api({ action: "query", list: "categorymembers", cmtitle: category, cmtype: "subcat|file", cmlimit: "500", ...(continuation ? { cmcontinue: continuation } : {}) });
    result.push(...(json.query?.categorymembers ?? []));
    continuation = json.continue?.cmcontinue;
  } while (continuation);
  return result;
}

async function discover(rootCategory: string, limit: number): Promise<{ files: string[]; categoryTrail: Map<string, string[]>; incomplete: boolean }> {
  const pending = [rootCategory];
  const visited = new Set<string>();
  const categoryTrail = new Map<string, string[]>();
  const files = new Set<string>();
  let incomplete = false;
  while (pending.length) {
    const category = pending.shift()!;
    if (visited.has(category)) continue;
    visited.add(category);
    for (const member of await categoryMembers(category)) {
      if (member.ns === 14) pending.push(member.title);
      if (member.ns === 6) {
        files.add(member.title);
        const trail = categoryTrail.get(member.title) ?? [];
        if (!trail.includes(category)) trail.push(category);
        categoryTrail.set(member.title, trail.sort((a, b) => a.localeCompare(b)));
        if (files.size >= limit) { incomplete = true; return { files: [...files].sort((a, b) => a.localeCompare(b)), categoryTrail, incomplete }; }
      }
    }
  }
  return { files: [...files].sort((a, b) => a.localeCompare(b)), categoryTrail, incomplete };
}

async function imageInfo(titles: string[]): Promise<Map<string, ImageInfo>> {
  const result = new Map<string, ImageInfo>();
  for (let index = 0; index < titles.length; index += 50) {
    const json = await api({ action: "query", prop: "imageinfo", iiprop: "url|sha1|mime|size|timestamp", iiurlwidth: "512", titles: titles.slice(index, index + 50).join("|") });
    for (const page of json.query?.pages ?? []) {
      const info = page.imageinfo?.[0] as ImageInfo | undefined;
      if (info?.url && info.sha1 && info.mime) result.set(page.title, info);
    }
  }
  return result;
}

async function sha1(path: string): Promise<string> { return createHash("sha1").update(await readFile(path)).digest("hex"); }
function canVerifySha1(value: string): boolean { return /^[a-f0-9]{40}$/i.test(value); }
async function download(entry: UespIconEntry, target: string, dryRun: boolean, expectedSha1: string | null): Promise<string> {
  if (dryRun) return entry.sha1;
  try {
    if ((await stat(target)).isFile()) {
      const actual = await sha1(target);
      if (!expectedSha1 || actual.toLowerCase() === expectedSha1.toLowerCase()) return actual;
    }
  } catch { /* absent */ }
  const partial = `${target}.part`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      let partialBytes = 0;
      try { partialBytes = (await stat(partial)).size; } catch { /* no partial transfer yet */ }
      const response = await fetch(entry.originalUrl, { headers: { "User-Agent": USER_AGENT, "Accept": "image/*", ...(partialBytes > 0 ? { Range: `bytes=${partialBytes}-` } : {}) }, signal: AbortSignal.timeout(45_000) });
      if (response.status === 416 && partialBytes > 0) {
        const total = Number(response.headers.get("content-range")?.match(/\/(\d+)$/)?.[1]);
        if (Number.isInteger(total) && total === partialBytes) {
          const actual = await sha1(partial);
          if (expectedSha1 && actual.toLowerCase() !== expectedSha1.toLowerCase()) throw new Error(`SHA-1 mismatch for ${entry.title}: expected ${expectedSha1}, received ${actual}.`);
          await rename(partial, target);
          return actual;
        }
        await unlink(partial);
        throw new Error(`stale partial transfer was reset after a 416 response`);
      }
      if (!response.ok || !response.body) throw new Error(`download returned ${response.status}`);
      // UESP/CDN range support lets interrupted large files resume; a server that replies 200
      // to a range request simply restarts that one file safely.
      const append = partialBytes > 0 && response.status === 206;
      await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), createWriteStream(partial, { flags: append ? "a" : "w" }));
      const actual = await sha1(partial);
      if (expectedSha1 && actual.toLowerCase() !== expectedSha1.toLowerCase()) throw new Error(`SHA-1 mismatch for ${entry.title}: expected ${expectedSha1}, received ${actual}.`);
      await rename(partial, target);
      return actual;
    } catch (error) {
      if (attempt === 5) throw error;
      await pause(750 * attempt);
    }
  }
  throw new Error(`Download attempts exhausted for ${entry.title}.`);
}

async function runPool<T>(values: T[], concurrency: number, work: (value: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      await work(values[index]!);
    }
  }));
}

async function readManifest(path: string): Promise<Manifest | null> {
  try { return JSON.parse(await readFile(path, "utf8")) as Manifest; } catch { return null; }
}

function isCommerceIcon(entry: UespIconEntry): boolean {
  const text = [entry.title, ...entry.categoryTrail].join(" ");
  return /(?:^|[-_ :])(armor|clothing|weapon|ammo|ammunition|ingredient|alchemy|food|drink|potion|poison|book|scroll|soulgem|soul gem|ore|ingot|hide|leather|jewelry|jewellery|misc)(?:[-_ :]|$)/i.test(text);
}

async function main() {
  const output = argument("--output", DEFAULT_OUTPUT)!;
  const limit = positive("--limit", Number.MAX_SAFE_INTEGER);
  const concurrency = positive("--concurrency", 3);
  const dryRun = flag("--dry-run");
  const rootCategory = argument("--category", "Category:Skyrim-Icons")!;
  const assetDirectory = join(output, "assets");
  await mkdir(assetDirectory, { recursive: true });
  const previous = await readManifest(join(output, MANIFEST_NAME));
  const priorByTitle = new Map((previous?.files ?? []).map((entry) => [entry.canonicalTitle, entry]));
  const found = await discover(rootCategory, limit);
  const infoByTitle = await imageInfo(found.files);
  const entries: UespIconEntry[] = [];
  for (const title of found.files) {
    const info = infoByTitle.get(title);
    if (!info?.url || !info.sha1 || !info.mime) continue;
    const downloadedUrl = info.thumburl ?? info.url;
    const prior = priorByTitle.get(title);
    const canReusePrior = prior?.originalUrl === downloadedUrl;
    const localFile = canReusePrior ? basename(prior.localPath) : safeFilename(title, downloadedUrl);
    entries.push({ title, canonicalTitle: title, sourcePageUrl: info.descriptionurl ?? sourcePageUrl(title), originalUrl: downloadedUrl, sha1: canReusePrior ? prior.sha1 : info.sha1, mime: info.mime, width: info.thumbwidth ?? info.width ?? null, height: info.thumbheight ?? info.height ?? null, bytes: info.thumburl ? null : info.size ?? null, timestamp: info.timestamp ?? null, categoryTrail: found.categoryTrail.get(title) ?? [], localPath: `/uesp-icons/${localFile}` });
  }
  entries.sort((left, right) => left.canonicalTitle.localeCompare(right.canonicalTitle));
  const source = { wiki: "https://en.uesp.net", rootCategory, fetchedAt: new Date().toISOString(), userAgent: USER_AGENT };
  // Persist discovery before transfers so an interrupted crawl retains canonical URLs,
  // filenames and category provenance and can resume without reconstructing partial state.
  if (!dryRun) await writeFile(join(output, MANIFEST_NAME), `${JSON.stringify({ schemaVersion: "1", source, files: entries, incomplete: true }, null, 2)}\n`);
  const unavailable: UnavailableFile[] = [];
  await runPool(entries, concurrency, async (entry) => {
    try {
      const isOriginal = !entry.originalUrl.includes("/thumb/");
      const expectedSha1 = isOriginal && canVerifySha1(entry.sha1) ? entry.sha1 : null;
      entry.sha1 = await download(entry, join(assetDirectory, basename(entry.localPath)), dryRun, expectedSha1);
      if (!dryRun) entry.bytes = (await stat(join(assetDirectory, basename(entry.localPath)))).size;
      if (!canVerifySha1(entry.sha1)) throw new Error(`Could not establish a local SHA-1 for ${entry.title}.`);
    } catch (error) {
      unavailable.push({ title: entry.title, sourcePageUrl: entry.sourcePageUrl, originalUrl: entry.originalUrl, reason: error instanceof Error ? error.message : String(error) });
    }
  });
  const unavailableTitles = new Set(unavailable.map((entry) => entry.title));
  const unavailableCommerce = entries.filter((entry) => unavailableTitles.has(entry.title) && isCommerceIcon(entry));
  if (unavailableCommerce.length) throw new Error(`${unavailableCommerce.length} commerce icon downloads failed; re-run ingestion to resume them.`);
  const completed = entries.filter((entry) => !unavailableTitles.has(entry.title));
  const manifest: Manifest = { schemaVersion: "1", source, files: completed, ...(found.incomplete ? { incomplete: true } : {}), ...(unavailable.length ? { unavailable: unavailable.sort((left, right) => left.title.localeCompare(right.title)) } : {}) };
  await writeFile(join(output, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ output, discovered: found.files.length, resolved: completed.length, unavailable: unavailable.length, downloaded: dryRun ? 0 : completed.length, dryRun, incomplete: found.incomplete }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
