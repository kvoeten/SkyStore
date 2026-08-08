import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/runtime";
import { stores } from "@/db/schema";
import { canAccessStore, getAccessContext } from "@/lib/authorization";

export type StaffPageStore = { id: string; name: string; targetMarkupBps: number; role: string; verified: boolean; storeQuery: string; displayName?: string | null };

/** Pages retain the requested tenant in links; the initial selection is the user's first live membership. */
export async function resolveStaffPageStore(requestedStoreId?: string): Promise<StaffPageStore | null> {
  const context = await getAccessContext();
  if (!context) redirect("/login");
  let storeId = requestedStoreId ?? context.memberships[0]?.storeId;
  if (!storeId && context.globalRole === "platform_admin") {
    const [firstStore] = await db.select({ id: stores.id }).from(stores).orderBy(asc(stores.name)).limit(1);
    storeId = firstStore?.id;
  }
  if (!storeId) return null;
  const access = canAccessStore(context, storeId);
  if (!access) return null;
  const [store] = await db.select({ id: stores.id, name: stores.name, targetMarkupBps: stores.targetMarkupBps }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return null;
  return { ...store, role: access.role, verified: access.trust === "verified", storeQuery: `?storeId=${encodeURIComponent(store.id)}`, displayName: access.displayName ?? context.displayName };
}

export function staffShellIdentity(store: StaffPageStore) {
  const initials = store.displayName?.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return { storeName: store.name, storeId: store.id, displayName: store.displayName ?? undefined, initials: initials || undefined, role: `${store.role} access`, verified: store.verified };
}
