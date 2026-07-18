import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
const connectionOptions = {
  prepare: false,
  // Homepage endpoints load independently; a single local connection turns
  // those requests into a queue and can exceed the client-side retry window.
  max: 3,
  idle_timeout: 20,
  connect_timeout: 5,
};

// Disable prefetch for Supabase transaction mode pooler
declare global {
  var pgClient: ReturnType<typeof postgres> | undefined;
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
