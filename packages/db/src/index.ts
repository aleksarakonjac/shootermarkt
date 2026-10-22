import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
const connectionOptions = {
  prepare: false,
  // fetch_types ostaje uključen: bez njega postgres.js ne serijalizuje nizove (text[]/varchar[] kolone,
  // = ANY($1)) — "malformed array literal". Cena je jedan pg_type upit po novoj konekciji.
  max: 5,
  idle_timeout: 20,
  connect_timeout: 15,
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
