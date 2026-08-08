import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/runtime";
import { auditEvents, memberships } from "@/db/schema";
import { isStoreAccessFailure, selectStore } from "@/lib/services/store-access";

const input = z.object({ displayName: z.string().trim().max(120).nullable() });
export async function PATCH(request: NextRequest) { const store = await selectStore(request); if (isStoreAccessFailure(store)) return NextResponse.json({ error: store.error }, { status: store.status }); const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "invalid_display_name", issues: parsed.error.issues }, { status: 400 }); const displayName = parsed.data.displayName || null; const [membership] = await db.transaction(async (tx) => { const [row] = await tx.update(memberships).set({ displayName }).where(and(eq(memberships.storeId, store.id), eq(memberships.userId, store.context.userId))).returning({ displayName: memberships.displayName }); await tx.insert(auditEvents).values({ actorId: store.context.userId, storeId: store.id, action: "membership.display_name.updated", entityType: "membership", after: { userId: store.context.userId, displayName } }); return [row]; }); return NextResponse.json({ displayName: membership.displayName }); }
