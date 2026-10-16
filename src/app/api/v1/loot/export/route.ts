import {NextRequest,NextResponse} from "next/server";
import {getAccessContext} from "@/lib/authorization";
import {canManageWhiterunStorage} from "@/lib/loot/access";
import {getLootDashboard} from "@/lib/loot/service";
import {exportLootWorkbook} from "@/lib/loot/excel-export";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const context=await getAccessContext();
 if(!canManageWhiterunStorage(context))return NextResponse.json({error:"Only the event owner and administrator can export."},{status:403});
 const dashboard=await getLootDashboard(context);if(!dashboard.manage)return NextResponse.json({error:"Access denied."},{status:403});
 const event=dashboard.events.find(row=>row.id===request.nextUrl.searchParams.get("eventId"));
 if(!event?.plan)return NextResponse.json({error:"Saved event plan not found. Save or repack it first."},{status:404});
 const file=await exportLootWorkbook(event,dashboard.assignments,dashboard.users,dashboard.purchases);
 return new NextResponse(new Uint8Array(file),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="skystore-event-${event.id}.xlsx"`,"Cache-Control":"private, no-store"}});
}
