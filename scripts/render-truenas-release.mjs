import { readFile, writeFile } from "node:fs/promises";

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${name} is required.`);
  return process.argv[index + 1];
}

const template = argument("--template");
const image = argument("--image");
const output = argument("--output");
const pinnedImage = /^ghcr\.io\/kvoeten\/skystore@sha256:[a-f0-9]{64}$/.test(image);
const stableImage = image === "ghcr.io/kvoeten/skystore:stable";
const allowStable = process.argv.includes("--allow-stable");
if (!pinnedImage && !(allowStable && stableImage)) throw new Error("The release image must be pinned by GHCR digest, or use the explicitly allowed stable channel.");
const source = await readFile(template, "utf8");
const placeholder = "ghcr.io/kvoeten/skystore:RELEASE_TAG";
if ((source.match(new RegExp(placeholder, "g")) ?? []).length !== 5) throw new Error("The TrueNAS template has an unexpected image placeholder count.");
await writeFile(output, source.replaceAll(placeholder, image));
