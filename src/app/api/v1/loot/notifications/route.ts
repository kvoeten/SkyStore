import { and, count, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/runtime";
import { lootBoxes } from "@/db/schema";
import { getAccessContext } from "@/lib/authorization";
export const dynamic="force-dynamic";
export async function GET() {
  const context=await getAccessContext();
  if(!context) return NextResponse.json({unopened:0},{status:401,headers:{"Cache-Control":"private, no-store"}});
  const [result]=await db.select({unopened:count()}).from(lootBoxes).where(and(eq(lootBoxes.userId,context.userId),isNull(lootBoxes.openedAt)));
  return NextResponse.json(result,{headers:{"Cache-Control":"private, no-store"}});
}
