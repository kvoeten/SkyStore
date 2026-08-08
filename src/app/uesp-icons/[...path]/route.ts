import { lstat, readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveCatalogImage } from "@/lib/catalog/image-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/uesp-icons/[...path]">) {
  const { path } = await context.params;
  const image = resolveCatalogImage(path);
  if (!image) return new NextResponse(null, { status: 404 });

  try {
    const file = await lstat(image.filePath);
    if (!file.isFile() || file.isSymbolicLink()) return new NextResponse(null, { status: 404 });
    const bytes = await readFile(image.filePath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(bytes.byteLength),
        "Content-Type": image.contentType,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "ENOENT" || code === "EISDIR") return new NextResponse(null, { status: 404 });
    throw error;
  }
}
