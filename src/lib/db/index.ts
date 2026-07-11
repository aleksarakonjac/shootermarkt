import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch for Supabase transaction mode pooler
declare global {
  // eslint-disable-next-line no-var
  var pgClient: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var db: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

let client: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle<typeof schema>>;

if (process.env.NODE_ENV === "production") {
  client = postgres(connectionString, { prepare: false, max: 3 });
  db = drizzle(client, { schema });
} else {
  if (!globalThis.pgClient) {
    globalThis.pgClient = postgres(connectionString, { prepare: false, max: 3 });
  }
  client = globalThis.pgClient;

  if (!globalThis.db) {
    globalThis.db = drizzle(client, { schema });
  }
  db = globalThis.db;
}

export { db };
