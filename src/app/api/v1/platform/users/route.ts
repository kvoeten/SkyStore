import { asc, desc, isNotNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/runtime";
import { users } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";
export async function GET(request: NextRequest) { const context = await getAccessContext(); if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 }); if (context.globalRole !== "platform_admin") return NextResponse.json({ error: "platform_admin_required" }, { status: 403 }); const quarantined = request.nextUrl.searchParams.get("quarantined"); const rows = await db.select({ id: users.id, name: users.name, discordId: users.discordId, globalRole: users.globalRole, quarantinedAt: users.quarantinedAt, quarantineReason: users.quarantineReason, createdAt: users.createdAt }).from(users).where(quarantined === "true" ? isNotNull(users.quarantinedAt) : undefined).orderBy(desc(users.createdAt), asc(users.id)).limit(200); return NextResponse.json({ users: rows }); }
