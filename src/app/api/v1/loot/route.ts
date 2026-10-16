import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/authorization";
import { lootCommand } from "@/lib/loot/commands";
import { executeLootCommand, getLootDashboard, LootError } from "@/lib/loot/service";
export const dynamic = "force-dynamic";
function failure(error:unknown) {
  if(error instanceof LootError) return NextResponse.json({error:error.message},{status:error.status,headers:{"Cache-Control":"private, no-store"}});
  console.error("Loot operation failed",error);
  return NextResponse.json({error:"The operation could not be completed. Please retry."},{status:500});
}
export async function GET() {
  try { return NextResponse.json(await getLootDashboard(await getAccessContext()),{headers:{"Cache-Control":"private, no-store"}}); } catch(error) { return failure(error); }
}
export async function POST(request:NextRequest) {
  const context=await getAccessContext();
  if(!context)return NextResponse.json({error:"Sign in with Discord first."},{status:401,headers:{"Cache-Control":"private, no-store"}});
  const origin=request.headers.get("origin"), host=request.headers.get("x-forwarded-host")??request.headers.get("host");
  try {
    if(request.headers.get("sec-fetch-site")==="cross-site" || (origin&&new URL(origin).host!==host)) return NextResponse.json({error:"Cross-site request rejected."},{status:403});
  } catch { return NextResponse.json({error:"Invalid origin."},{status:403}); }
  if(!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({error:"JSON required."},{status:415});
  const length=Number(request.headers.get("content-length")??0);
  if(length>21_000_000) return NextResponse.json({error:"File too large."},{status:413});
  const command=lootCommand.safeParse(await request.json().catch(()=>null));
  if(!command.success) return NextResponse.json({error:"Check the submitted fields.",issues:command.error.issues},{status:400});
  try { return NextResponse.json(await executeLootCommand(context,command.data),{headers:{"Cache-Control":"private, no-store"}}); } catch(error) { return failure(error); }
}
