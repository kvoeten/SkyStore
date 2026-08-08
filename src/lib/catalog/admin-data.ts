import { desc, inArray } from "drizzle-orm";
import { db } from "@/db/runtime";
import { auditEvents, catalogVersions } from "@/db/schema";
import type { CatalogImportIssue } from "./bundle";

export type CatalogVersionAdminView = {
  id: string;
  version: string;
  status: "staged" | "active" | "retired";
  sourceLoadOrderHash: string;
  createdAt: string;
  activatedAt: string | null;
  report: CatalogStagingReport | null;
};

export type CatalogStagingReport = {
  importedItemCount: number;
  importedAliasCount: number;
  importedImageCount: number;
  blockingIssueCount: number;
  issues: CatalogImportIssue[];
};

export async function getCatalogAdminData(): Promise<CatalogVersionAdminView[]> {
  const versions = await db.select().from(catalogVersions).orderBy(desc(catalogVersions.createdAt));
  if (versions.length === 0) return [];
  const reports = await db.select({ entityId: auditEvents.entityId, after: auditEvents.after, occurredAt: auditEvents.occurredAt }).from(auditEvents)
    .where(inArray(auditEvents.entityId, versions.map((version) => version.id)))
    .orderBy(desc(auditEvents.occurredAt));
  const reportByVersion = new Map<string, CatalogStagingReport>();
  for (const report of reports) {
    if (!report.entityId || reportByVersion.has(report.entityId)) continue;
    const parsed = parseStagingReport(report.after);
    if (parsed) reportByVersion.set(report.entityId, parsed);
  }
  return versions.map((version) => ({
    id: version.id,
    version: version.version,
    status: version.status,
    sourceLoadOrderHash: version.sourceLoadOrderHash,
    createdAt: version.createdAt.toISOString(),
    activatedAt: version.activatedAt?.toISOString() ?? null,
    report: reportByVersion.get(version.id) ?? null
  }));
}

function parseStagingReport(value: unknown): CatalogStagingReport | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const issues = Array.isArray(record.issues) ? record.issues.filter(isIssue) : [];
  if (typeof record.importedItemCount !== "number") return null;
  return {
    importedItemCount: record.importedItemCount,
    importedAliasCount: typeof record.importedAliasCount === "number" ? record.importedAliasCount : 0,
    importedImageCount: typeof record.importedImageCount === "number" ? record.importedImageCount : 0,
    blockingIssueCount: typeof record.blockingIssueCount === "number" ? record.blockingIssueCount : 0,
    issues
  };
}

function isIssue(value: unknown): value is CatalogImportIssue {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.stableKey === "string" && typeof record.code === "string" && typeof record.blocking === "boolean" && typeof record.detail === "string";
}
