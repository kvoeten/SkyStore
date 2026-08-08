import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/runtime";
import { catalogVersions } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";

export async function GET() {
  const access = await getAccessContext();
  if (!access) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (access.globalRole !== "platform_admin") return NextResponse.json({ error: "platform_admin_required" }, { status: 403 });
  const versions = await db.select({ id: catalogVersions.id, version: catalogVersions.version, status: catalogVersions.status, sourceLoadOrderHash: catalogVersions.sourceLoadOrderHash, createdAt: catalogVersions.createdAt, activatedAt: catalogVersions.activatedAt })
    .from(catalogVersions).orderBy(desc(catalogVersions.createdAt));
  return NextResponse.json({ versions });
}
