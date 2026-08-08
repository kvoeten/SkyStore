import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAccessContext } from "@/lib/authorization";
import { CatalogBundleError } from "@/lib/catalog/bundle";
import { CatalogImportFileError, readCatalogImportFile } from "@/lib/catalog/import-file";
import { CatalogStageError, stageCatalogBundle } from "@/lib/catalog/staging";

const requestSchema = z.object({ fileName: z.string().min(1).max(512) }).strict();

/** Stages a bundle that an administrator has already placed in SKYSTORE_CATALOG_IMPORT_DIR. */
export async function POST(request: NextRequest) {
  const access = await getAccessContext();
  if (!access) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (access.globalRole !== "platform_admin") return NextResponse.json({ error: "platform_admin_required" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_catalog_import_request", issues: parsed.error.issues }, { status: 400 });
  try {
    const { bundle, issues } = await readCatalogImportFile(parsed.data.fileName);
    const staged = await stageCatalogBundle(bundle, access.userId, issues);
    return NextResponse.json({ ...staged, state: "staged" }, { status: 201 });
  } catch (error) {
    if (error instanceof CatalogBundleError) return NextResponse.json({ error: "invalid_catalog_bundle", issues: error.issues }, { status: 422 });
    if (error instanceof CatalogImportFileError) return NextResponse.json({ error: "catalog_import_file_error", detail: error.message }, { status: 400 });
    if (error instanceof CatalogStageError) return NextResponse.json({ error: error.code, detail: error.message }, { status: 409 });
    throw error;
  }
}
