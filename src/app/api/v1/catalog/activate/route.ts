import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAccessContext } from "@/lib/authorization";
import { CatalogStageError, activateCatalogVersion } from "@/lib/catalog/staging";

const requestSchema = z.object({ version: z.string().min(3).max(80) }).strict();

export async function POST(request: NextRequest) {
  const access = await getAccessContext();
  if (!access) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (access.globalRole !== "platform_admin") return NextResponse.json({ error: "platform_admin_required" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_catalog_activation_request", issues: parsed.error.issues }, { status: 400 });
  try {
    return NextResponse.json({ ...(await activateCatalogVersion(parsed.data.version, access.userId)), state: "active" });
  } catch (error) {
    if (error instanceof CatalogStageError) return NextResponse.json({ error: error.code, detail: error.message }, { status: 409 });
    throw error;
  }
}
