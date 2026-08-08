import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/runtime";
import { auditEvents, stores } from "@/db/schema";
import { mayManageStore } from "@/lib/authorization";
import { isStoreAccessFailure, selectStore } from "@/lib/services/store-access";

const input = z.object({ targetMarkupBps: z.number().int().min(0).max(100000) });
export async function PATCH(request: NextRequest) { const store = await selectStore(request); if (isStoreAccessFailure(store)) return NextResponse.json({ error: store.error }, { status: store.status }); if (!mayManageStore(store.access)) return NextResponse.json({ error: "store_management_forbidden" }, { status: 403 }); const parsed = input.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "invalid_pricing_target", issues: parsed.error.issues }, { status: 400 }); const [updated] = await db.transaction(async (tx) => { const [row] = await tx.update(stores).set({ targetMarkupBps: parsed.data.targetMarkupBps, updatedAt: new Date() }).where(eq(stores.id, store.id)).returning({ targetMarkupBps: stores.targetMarkupBps }); await tx.insert(auditEvents).values({ actorId: store.context.userId, storeId: store.id, action: "store.target_markup.updated", entityType: "store", entityId: store.id, after: row }); return [row]; }); return NextResponse.json(updated); }
