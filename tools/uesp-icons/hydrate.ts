import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const DEFAULT_OUTPUT = "catalog/generated/uesp-icons";
const USER_AGENT = "SkyStore/0.1 release asset verifier";

type IconEntry = {
  title: string;
  originalUrl: string;
  sha1: string;
  bytes: number | null;
  localPath: string;
};

type Manifest = {
  schemaVersion: "1";
  incomplete?: boolean;
  files: IconEntry[];
};

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1] ?? fallback;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(argument(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1 || value > 32) throw new Error(`${name} must be between 1 and 32.`);
  return value;
}

async function sha1(filePath: string): Promise<string> {
  return createHash("sha1").update(await readFile(filePath)).digest("hex");
}

function targetName(entry: IconEntry): string {
  const name = basename(entry.localPath);
  if (entry.localPath !== `/uesp-icons/${name}` || !name) throw new Error(`Unsafe local icon path for ${entry.title}.`);
  const source = new URL(entry.originalUrl);
  if (source.protocol !== "https:" || source.hostname !== "images.uesp.net") throw new Error(`Unapproved icon host for ${entry.title}.`);
  if (!/^[a-f0-9]{40}$/i.test(entry.sha1)) throw new Error(`Invalid SHA-1 for ${entry.title}.`);
  if (!Number.isSafeInteger(entry.bytes) || (entry.bytes ?? 0) < 1) throw new Error(`Missing byte count for ${entry.title}.`);
  return name;
}

async function validExisting(filePath: string, entry: IconEntry): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size === entry.bytes && await sha1(filePath) === entry.sha1.toLowerCase();
  } catch {
    return false;
  }
}

async function hydrate(entry: IconEntry, assetDirectory: string): Promise<"cached" | "downloaded"> {
  const target = join(assetDirectory, targetName(entry));
  if (await validExisting(target, entry)) return "cached";
  const partial = `${target}.part`;
  await unlink(partial).catch(() => undefined);
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(entry.originalUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
        signal: AbortSignal.timeout(60_000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== entry.bytes) throw new Error(`expected ${entry.bytes} bytes, received ${bytes.byteLength}`);
      const actual = createHash("sha1").update(bytes).digest("hex");
      if (actual !== entry.sha1.toLowerCase()) throw new Error(`expected SHA-1 ${entry.sha1}, received ${actual}`);
      await writeFile(partial, bytes, { flag: "wx" });
      await rename(partial, target);
      return "downloaded";
    } catch (error) {
      lastError = error;
      await unlink(partial).catch(() => undefined);
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw new Error(`Could not hydrate ${entry.title}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function runPool<T>(values: T[], concurrency: number, work: (value: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) await work(values[cursor++]!);
  }));
}

async function main() {
  const output = argument("--output", DEFAULT_OUTPUT);
  const concurrency = positiveInteger("--concurrency", 6);
  const manifest = JSON.parse(await readFile(join(output, "uesp-icons-manifest.json"), "utf8")) as Manifest;
  if (manifest.schemaVersion !== "1" || manifest.incomplete || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error("A complete UESP icon manifest is required.");
  }
  const assetDirectory = join(output, "assets");
  await mkdir(assetDirectory, { recursive: true });
  let cached = 0;
  let downloaded = 0;
  await runPool(manifest.files, concurrency, async (entry) => {
    const result = await hydrate(entry, assetDirectory);
    if (result === "cached") cached++;
    else downloaded++;
  });
  console.log(JSON.stringify({ status: "complete", files: manifest.files.length, cached, downloaded }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
