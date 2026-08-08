import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

// Importing the schema or pure market engine must not open a connection. Runtime entry points
// call this factory once and share the returned client for their process lifetime.
export function createDatabase(url = databaseUrl) {
  if (!url) throw new Error("DATABASE_URL is required to create a SkyStore database connection.");
  const client = postgres(url, { max: 10 });
  return { db: drizzle(client, { schema }), client };
}

export type SkyStoreDb = ReturnType<typeof createDatabase>["db"];
