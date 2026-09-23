import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/runtime";
import { auditEvents, customLedgerSubmissions, users } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";

export const runtime = "nodejs";
const allowedExtensions = new Set([".csv", ".tsv", ".xlsx", ".xls", ".pdf", ".doc", ".docx", ".txt"]);
const maxBytes = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_ledger_submission" }, { status: 400 });
  const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
  const plaintext = String(form.get("plaintext") ?? "").trim();
  const file = form.get("file");
  if (!sourceUrl && !plaintext && !(file instanceof File && file.size)) return NextResponse.json({ error: "ledger_source_required" }, { status: 400 });
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return NextResponse.json({ error: "invalid_source_url" }, { status: 400 });
  if (plaintext.length > 100_000) return NextResponse.json({ error: "plaintext_too_large" }, { status: 400 });
  let fileName: string | null = null; let filePath: string | null = null; let mimeType: string | null = null; let fileSize: number | null = null;
  if (file instanceof File && file.size) {
    if (file.size > maxBytes) return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    const extension = path.extname(file.name).toLocaleLowerCase();
    if (!allowedExtensions.has(extension)) return NextResponse.json({ error: "unsupported_file_type" }, { status: 400 });
    fileName = path.basename(file.name).slice(0, 255); mimeType = file.type.slice(0, 160) || null; fileSize = file.size;
    const directory = process.env.SKYSTORE_UPLOAD_DIR ?? "/var/lib/skystore/uploads";
    await mkdir(directory, { recursive: true });
    const safeName = `${randomUUID()}${extension}`;
    // The persistent upload directory is configured by deployment, not bundled.
    filePath = path.join(/* turbopackIgnore: true */ directory, safeName);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
  }
  const access = await getAccessContext();
  const [user] = access ? await db.select({ name: users.name, displayName: users.displayName }).from(users).where(eq(users.id, access.userId)).limit(1) : [];
  const contributorDisplayName = user?.displayName ?? user?.name ?? "Anonymous visitor";
  const [submission] = await db.insert(customLedgerSubmissions).values({ submittedBy: access?.userId ?? null, contributorDisplayName, sourceUrl: sourceUrl || null, plaintext: plaintext || null, fileName, filePath, mimeType, fileSize }).returning({ id: customLedgerSubmissions.id });
  await db.insert(auditEvents).values({ actorId: access?.userId ?? null, action: "custom_ledger.submitted", entityType: "custom_ledger_submission", entityId: submission.id, after: { sourceUrl: sourceUrl || null, fileName, fileSize, hasPlaintext: Boolean(plaintext) } });
  return NextResponse.json({ id: submission.id, status: "pending" }, { status: 201 });
}

export async function GET() {
  const access = await getAccessContext();
  if (access?.globalRole !== "platform_admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const submissions = await db.select({ id: customLedgerSubmissions.id, contributorDisplayName: customLedgerSubmissions.contributorDisplayName, sourceUrl: customLedgerSubmissions.sourceUrl, plaintext: customLedgerSubmissions.plaintext, fileName: customLedgerSubmissions.fileName, mimeType: customLedgerSubmissions.mimeType, fileSize: customLedgerSubmissions.fileSize, status: customLedgerSubmissions.status, adminNote: customLedgerSubmissions.adminNote, createdAt: customLedgerSubmissions.createdAt }).from(customLedgerSubmissions).orderBy(desc(customLedgerSubmissions.createdAt)).limit(100);
  return NextResponse.json({ submissions });
}

export async function PATCH(request: NextRequest) {
  const access = await getAccessContext();
  if (access?.globalRole !== "platform_admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: string; status?: "approved" | "rejected"; adminNote?: string } | null;
  if (!body?.id || !["approved", "rejected"].includes(body.status ?? "")) return NextResponse.json({ error: "invalid_ledger_review" }, { status: 400 });
  await db.update(customLedgerSubmissions).set({ status: body.status!, adminNote: body.adminNote?.trim().slice(0, 10_000) || null, reviewedBy: access.userId, reviewedAt: new Date() }).where(eq(customLedgerSubmissions.id, body.id));
  return NextResponse.json({ ok: true });
}
