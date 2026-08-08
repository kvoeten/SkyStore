/* eslint-disable @typescript-eslint/no-unused-vars */
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/runtime";
import { auditEvents, users } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";
export async function GET(_request: NextRequest) { const context = await getAccessContext(); if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 }); if (context.globalRole !== "platform_admin") return NextResponse.json({ error: "platform_admin_required" }, { status: 403 }); const rows = await db.select({ id: auditEvents.id, action: auditEvents.action, entityType: auditEvents.entityType, entityId: auditEvents.entityId, storeId: auditEvents.storeId, occurredAt: auditEvents.occurredAt, actorId: auditEvents.actorId, actorName: users.name, actorDiscordId: users.discordId, after: auditEvents.after }).from(auditEvents).leftJoin(users, eq(auditEvents.actorId, users.id)).orderBy(desc(auditEvents.occurredAt)).limit(200); return NextResponse.json({ events: rows }); }
