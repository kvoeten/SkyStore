/* eslint-disable @typescript-eslint/no-unused-vars */
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/runtime";
import { memberships, stores } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";
export async function GET(_request: NextRequest) { const context = await getAccessContext(); if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 }); if (context.globalRole !== "platform_admin") return NextResponse.json({ error: "platform_admin_required" }, { status: 403 }); const rows = await db.select({ id: stores.id, name: stores.name, slug: stores.slug, active: stores.active, ownerId: stores.ownerId, createdAt: stores.createdAt, memberCount: count(memberships.userId) }).from(stores).leftJoin(memberships, and(eq(memberships.storeId, stores.id), isNull(memberships.revokedAt))).groupBy(stores.id).orderBy(asc(stores.name)); return NextResponse.json({ stores: rows }); }
