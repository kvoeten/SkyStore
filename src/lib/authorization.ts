import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db/runtime";
import { memberships } from "@/db/schema";

export type StoreAccess = {
  storeId: string;
  role: "clerk" | "manager" | "owner";
  trust: "unverified" | "verified";
  displayName?: string | null;
};

export type AccessContext = {
  userId: string;
  displayName?: string | null;
  discordId?: string | null;
  globalRole: "user" | "platform_admin";
  memberships: StoreAccess[];
};

export async function getAccessContext(): Promise<AccessContext | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.quarantined) return null;
  const rows = await db.select({ storeId: memberships.storeId, role: memberships.role, trust: memberships.trust, displayName: memberships.displayName }).from(memberships).where(and(eq(memberships.userId, session.user.id), isNull(memberships.revokedAt)));
  return { userId: session.user.id, displayName: session.user.name, discordId: session.user.discordId, globalRole: session.user.globalRole, memberships: rows };
}

export async function requireAccess(): Promise<AccessContext> {
  const context = await getAccessContext();
  if (!context) redirect("/login");
  return context;
}

export function canAccessStore(context: AccessContext, storeId: string): StoreAccess | undefined {
  if (context.globalRole === "platform_admin") return context.memberships.find((membership) => membership.storeId === storeId) ?? { storeId, role: "owner", trust: "verified" };
  return context.memberships.find((membership) => membership.storeId === storeId);
}

export function mayApprove(access: StoreAccess | undefined): boolean {
  return Boolean(access && access.trust === "verified");
}

export function mayManageStore(access: StoreAccess | undefined): boolean {
  return Boolean(access && (access.role === "manager" || access.role === "owner"));
}
