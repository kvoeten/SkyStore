import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LootWorkspace } from "@/components/loot-workspace";
import { getAccessContext } from "@/lib/authorization";
import { canManageWhiterunStorage } from "@/lib/loot/access";
export const dynamic="force-dynamic";
export default async function LootBoxesPage() {
  const context=await getAccessContext();
  if(!context) redirect("/login?returnTo=%2Floot-boxes");
  return <AppShell current="/loot-boxes" publicView publicAccount showAdmin={context.globalRole==="platform_admin"}><LootWorkspace manage={canManageWhiterunStorage(context)}/></AppShell>;
}
