import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
const connectionOptions = {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
};

// Disable prefetch for Supabase transaction mode pooler
declare global {
  // eslint-disable-next-line no-var
  var pgClient: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var db: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

if (!globalThis.pgClient) {
  globalThis.pgClient = postgres(connectionString, connectionOptions);
}
const client = globalThis.pgClient;

if (!globalThis.db) {
  globalThis.db = drizzle(client, { schema });
}
const db = globalThis.db;

export { db };
