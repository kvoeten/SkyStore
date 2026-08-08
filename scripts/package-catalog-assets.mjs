import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`${name} is required.`);
}

async function sha256(path) {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

const source = resolve(argument("--source", "catalog/generated"));
const output = resolve(argument("--output", "output/catalog-assets"));
const release = argument("--release");
if (!/^catalog-assets-[0-9A-Za-z._-]+$/.test(release)) throw new Error("--release must start with catalog-assets- and contain only safe filename characters.");

const itemRenders = join(source, "item-renders");
const imagesDirectory = join(itemRenders, "images");
const catalogPath = join(source, "skystore-catalog-current.json");
const reportPath = join(source, "skystore-catalog-report.json");
const artworkPath = join(itemRenders, "artwork-manifest.json");
const targetsPath = join(itemRenders, "render-targets.json");
const renderReportPath = join(itemRenders, "render-report.json");
for (const path of [catalogPath, reportPath, artworkPath, targetsPath, renderReportPath, imagesDirectory]) await access(path);

const [catalog, artwork, targets, renderReport] = await Promise.all([
  readFile(catalogPath, "utf8").then(JSON.parse),
  readFile(artworkPath, "utf8").then(JSON.parse),
  readFile(targetsPath, "utf8").then(JSON.parse),
  readFile(renderReportPath, "utf8").then(JSON.parse),
]);
const imageNames = (await readdir(imagesDirectory)).filter((name) => name.endsWith(".png")).sort();
if (catalog.version !== targets.catalogVersion || catalog.version !== renderReport.catalogVersion) throw new Error("Catalog and render metadata versions differ.");
if (renderReport.renderedCount !== renderReport.targetCount || renderReport.renderedCount !== imageNames.length) throw new Error("Not every selected item has a rendered PNG.");
if (Object.keys(artwork).length !== imageNames.length) throw new Error("Artwork manifest count differs from the rendered PNG count.");
for (const [stableKey, webPath] of Object.entries(artwork)) {
  const match = /^\/item-renders\/([0-9a-f-]{36}-v[0-9]+-[0-9a-f]{12}\.png)$/.exec(webPath);
  if (!match || !imageNames.includes(match[1])) throw new Error(`${stableKey} has a missing or unsafe image path.`);
}

await mkdir(output, { recursive: true });
const staging = await mkdtemp(join(tmpdir(), "skystore-catalog-assets-"));
try {
  await cp(catalogPath, join(staging, basename(catalogPath)));
  await cp(reportPath, join(staging, basename(reportPath)));
  await mkdir(join(staging, "item-renders"));
  for (const path of [artworkPath, targetsPath, renderReportPath]) await cp(path, join(staging, "item-renders", basename(path)));
  await cp(imagesDirectory, join(staging, "item-renders", "images"), { recursive: true });

  const assetName = `skystore-catalog-assets-${release.slice("catalog-assets-".length)}.tar.gz`;
  const archive = join(output, assetName);
  execFileSync("tar", ["-czf", archive, "-C", staging, "."], { stdio: "inherit" });
  const lock = {
    schemaVersion: 2,
    release,
    asset: assetName,
    bytes: (await stat(archive)).size,
    sha256: await sha256(archive),
    targetsSha256: await sha256(targetsPath),
    reportSha256: await sha256(renderReportPath),
    catalogVersion: catalog.version,
    files: imageNames.length,
  };
  const lockPath = join(output, "catalog-assets.lock.generated.json");
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(JSON.stringify({ archive, lockPath, ...lock }, null, 2));
} finally {
  await rm(staging, { recursive: true, force: true });
}
