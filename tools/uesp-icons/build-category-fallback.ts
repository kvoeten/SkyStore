import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_DIRECTORY = "catalog/generated/catalog-icons";
const assetCategories: Record<string, string[]> = {
  "armor.png": ["Armor & clothing", "Jewelry"],
  "book.png": ["Books & scrolls", "Spell tomes"],
  "food.png": ["Food & drink"],
  "flower.png": ["Alchemy ingredients", "Flora", "Flowers"],
  "ingot.png": ["Ingots", "Ores & ingots"],
  "misc.png": ["Crafting materials", "Hides & leather", "Keys", "Miscellaneous", "Soul gems", "Tools & supplies"],
  "ore.png": ["Minerals", "Ores", "Ores & ingots"],
  "potion.png": ["Potions & poisons"],
  "weapon.png": ["Ammunition", "Weapons"]
};

function argument(name: string, fallback?: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : process.argv[at + 1];
}

async function main() {
  const directory = argument("--directory", DEFAULT_DIRECTORY)!;
  const files = await Promise.all(Object.entries(assetCategories).map(async ([file, categoryTrail]) => {
    const content = await readFile(join(directory, file));
    return {
      title: `SkyStore category artwork: ${file.replace(/\.png$/, "")}`,
      canonicalTitle: file,
      sourcePageUrl: `local:${file}`,
      originalUrl: `local:${file}`,
      sha1: createHash("sha1").update(content).digest("hex"),
      mime: "image/png",
      width: 512,
      height: 512,
      bytes: content.byteLength,
      timestamp: null,
      categoryTrail,
      localPath: `/catalog-icons/${file}`
    };
  }));
  const manifest = { schemaVersion: "1" as const, provider: "skystore_category_art" as const, source: { generatedBy: "SkyStore category artwork", generatedAt: new Date().toISOString() }, files: files.sort((left, right) => left.canonicalTitle.localeCompare(right.canonicalTitle)) };
  await writeFile(join(directory, "skystore-category-fallback-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ directory, files: files.length, manifest: join(directory, "skystore-category-fallback-manifest.json") }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
