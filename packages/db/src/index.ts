import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
const connectionOptions = {
  prepare: false,
  // Bez pipelining-a: sa prepare:false svaki upit sa parametrima šalje Describe+Flush pa čeka odgovor.
  // Ako se to pošalje na konekciju dok prethodni upit još radi, Supavisor (transaction mode) posle
  // Sync-a prethodnog može da prebaci konekciju na drugi backend i upit zauvek visi (ClientRead) —
  // to su bili 300 s timeout-i na /strelci i homepage-u. Reprodukovano i potvrđeno: 0 zaglavljivanja
  // sa max_pipeline: 0, i pod 3× paralelnim opterećenjem.
  max_pipeline: 0,
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
