import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl) throw new Error("DATABASE_URL nije podešen u .env.local");

async function main() {
  const sql = (postgres as unknown as (url: string, options: object) => ReturnType<typeof postgres>)(databaseUrl, { ssl: "require", max: 1 });
  await sql`ALTER TABLE "pdf_import_jobs" ADD COLUMN IF NOT EXISTS "source_url" varchar(1000)`;
  await sql`ALTER TABLE "pdf_import_jobs" ADD COLUMN IF NOT EXISTS "source_label" varchar(500)`;
  await sql`ALTER TABLE "pdf_import_jobs" ADD COLUMN IF NOT EXISTS "tags" varchar(20)[] NOT NULL DEFAULT '{}'`;
  await sql.end();
  console.log("Migracija izvora PDF importa je završena.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
