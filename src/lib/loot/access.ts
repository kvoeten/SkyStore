import type { AccessContext } from "@/lib/authorization";
export const WHITERUN_OWNER_DISCORD_ID = "314050267341520899";
export const WHITERUN_ADMIN_DISCORD_ID = "145997830052380674";
/** This private chest is not accessible to other verified clerks or managers. */
export function canManageWhiterunStorage(context: AccessContext | null): boolean {
  return Boolean(context && (context.discordId === WHITERUN_OWNER_DISCORD_ID || context.discordId === WHITERUN_ADMIN_DISCORD_ID));
}
