import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ready", database: "ok" });
  } catch {
    return NextResponse.json({ status: "not-ready", database: "unavailable" }, { status: 503 });
  }
}
