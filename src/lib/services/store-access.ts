import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/runtime";
import { stores } from "@/db/schema";
import { canAccessStore, getAccessContext, type AccessContext, type StoreAccess } from "@/lib/authorization";

export type SelectedStore = { id: string; name: string; targetMarkupBps: number; access: StoreAccess; context: AccessContext };
export type StoreAccessFailure = { status: 400 | 401 | 403 | 404; error: "store_id_required" | "invalid_store_id" | "unauthorized" | "store_forbidden" | "store_not_found" };

/** Resolves one explicit store scope. Never infer a user's first membership for an API query. */
export async function selectStore(request: Pick<Request, "headers" | "url">): Promise<SelectedStore | StoreAccessFailure> {
  const url = new URL(request.url);
  const queryStoreId = url.searchParams.get("storeId");
  const headerStoreId = request.headers.get("x-skystore-store-id");
  if (queryStoreId && headerStoreId && queryStoreId !== headerStoreId) return { status: 400, error: "invalid_store_id" };
  const storeId = queryStoreId ?? headerStoreId;
  if (!storeId) return { status: 400, error: "store_id_required" };
  if (!z.uuid().safeParse(storeId).success) return { status: 400, error: "invalid_store_id" };
  const context = await getAccessContext();
  if (!context) return { status: 401, error: "unauthorized" };
  const access = canAccessStore(context, storeId);
  if (!access) return { status: 403, error: "store_forbidden" };
  const [store] = await db.select({ id: stores.id, name: stores.name, targetMarkupBps: stores.targetMarkupBps }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return { status: 404, error: "store_not_found" };
  return { ...store, access, context };
}

export function isStoreAccessFailure(value: SelectedStore | StoreAccessFailure): value is StoreAccessFailure {
  return "error" in value;
}
