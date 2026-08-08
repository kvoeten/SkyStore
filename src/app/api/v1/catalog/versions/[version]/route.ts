import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/runtime";
import { auditEvents, catalogVersions } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";

export async function GET(_: Request, context: { params: Promise<{ version: string }> }) {
  const access = await getAccessContext();
  if (!access) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (access.globalRole !== "platform_admin") return NextResponse.json({ error: "platform_admin_required" }, { status: 403 });
  const { version } = await context.params;
  const [catalogVersion] = await db.select().from(catalogVersions).where(eq(catalogVersions.version, version)).limit(1);
  if (!catalogVersion) return NextResponse.json({ error: "catalog_version_not_found" }, { status: 404 });
  const [stagingReport] = await db.select({ after: auditEvents.after, occurredAt: auditEvents.occurredAt }).from(auditEvents)
    .where(and(eq(auditEvents.entityId, catalogVersion.id), eq(auditEvents.action, "catalog.import.staged"))).orderBy(desc(auditEvents.occurredAt)).limit(1);
  return NextResponse.json({
    version: {
      id: catalogVersion.id,
      version: catalogVersion.version,
      status: catalogVersion.status,
      sourceLoadOrderHash: catalogVersion.sourceLoadOrderHash,
      createdAt: catalogVersion.createdAt,
      activatedAt: catalogVersion.activatedAt
    },
    stagingReport: stagingReport ?? null
  });
}
