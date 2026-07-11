import { config } from "dotenv";
import postgres from "../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js";

config({ path: ".env.local" });
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

async function main() {
  const sql = (postgres as unknown as (url: string, opts: object) => ReturnType<typeof postgres>)(url!, { ssl: "require", max: 1 });

  // 1. enum tip
  await sql`DO $$ BEGIN
    CREATE TYPE age_category AS ENUM ('cadet','youth_junior','junior','u23','senior');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  console.log("✓ age_category enum");

  // 2. kolona (default senior za postojeće redove)
  await sql`ALTER TABLE "results" ADD COLUMN IF NOT EXISTS "category" age_category NOT NULL DEFAULT 'senior'`;
  console.log("✓ results.category kolona");

  // 3. zameni unique index da uključuje category
  await sql`DROP INDEX IF EXISTS "results_shooter_comp_disc_unique"`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "results_shooter_comp_disc_cat_unique"
    ON "results" ("shooter_id","competition_id","discipline_id","category")`;
  console.log("✓ unique index (shooter,comp,disc,category)");

  await sql.end();
  console.log("Gotovo.");
}

main().catch((e) => { console.error(e); process.exit(1); });
