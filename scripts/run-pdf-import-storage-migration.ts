import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl) throw new Error("DATABASE_URL nije podešen u .env.local");

async function main() {
  const sql = (postgres as unknown as (url: string, options: object) => ReturnType<typeof postgres>)(databaseUrl, { ssl: "require", max: 1 });
  await sql`ALTER TABLE "pdf_import_jobs" ALTER COLUMN "pdf_data" DROP NOT NULL`;
  await sql`ALTER TABLE "pdf_import_jobs" ADD COLUMN IF NOT EXISTS "pdf_storage_path" varchar(500)`;
  await sql`ALTER TABLE "pdf_import_jobs" ADD COLUMN IF NOT EXISTS "pdf_deleted_at" timestamp`;
  await sql`CREATE INDEX IF NOT EXISTS "pdf_import_jobs_cleanup_idx" ON "pdf_import_jobs" ("completed_at") WHERE "pdf_deleted_at" IS NULL`;
  await sql.end();
  console.log("Migracija PDF import Storage-a je završena.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
