import { createDatabase } from "./index";

const fallbackUrl = "postgres://skystore:skystore@127.0.0.1:5432/skystore";
const globalDatabase = globalThis as typeof globalThis & {
  skyStoreDatabase?: ReturnType<typeof createDatabase>;
};

export const database = globalDatabase.skyStoreDatabase ?? createDatabase(process.env.DATABASE_URL ?? fallbackUrl);

if (process.env.NODE_ENV !== "production") globalDatabase.skyStoreDatabase = database;

export const db = database.db;
