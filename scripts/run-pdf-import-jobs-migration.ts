import { config } from "dotenv";
import postgres from "../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL nije podešen u .env.local");

async function main() {
  const sql = (postgres as unknown as (url: string, options: object) => ReturnType<typeof postgres>)(databaseUrl, { ssl: "require", max: 1 });
  await sql`
    CREATE TABLE IF NOT EXISTS "pdf_import_jobs" (
      "id" serial PRIMARY KEY NOT NULL,
      "competition_id" integer NOT NULL REFERENCES "competitions"("id"),
      "status" varchar(20) NOT NULL DEFAULT 'queued',
      "pdf_data" bytea NOT NULL,
      "result" jsonb,
      "error" text,
      "attempts" integer NOT NULL DEFAULT 0,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "started_at" timestamp,
      "completed_at" timestamp,
      "updated_at" timestamp NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "pdf_import_jobs_status_idx" ON "pdf_import_jobs" ("status")`;
  await sql`CREATE INDEX IF NOT EXISTS "pdf_import_jobs_competition_idx" ON "pdf_import_jobs" ("competition_id")`;
  await sql.end();
  console.log("Migracija 0009_pdf_import_jobs je završena.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
