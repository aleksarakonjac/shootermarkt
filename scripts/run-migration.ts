import { config } from "dotenv";
import postgres from "../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
console.log("Connecting to:", url.slice(0, 50) + "...");

async function main() {
  const sql = (postgres as unknown as (url: string, opts: object) => ReturnType<typeof postgres>)(url!, { ssl: "require", max: 1 });

  console.log("Running migration 0006_ticker_tables...");

  await sql`
    CREATE TABLE IF NOT EXISTS "competition_schedule" (
      "id" serial PRIMARY KEY,
      "competition_id" integer NOT NULL REFERENCES "competitions"("id") ON DELETE CASCADE,
      "discipline_id" integer NOT NULL REFERENCES "disciplines"("id"),
      "stage" varchar(30) NOT NULL,
      "start_time" timestamp NOT NULL,
      "end_time" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ competition_schedule");

  await sql`CREATE INDEX IF NOT EXISTS "competition_schedule_comp_idx" ON "competition_schedule"("competition_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "competition_schedule_start_idx" ON "competition_schedule"("start_time")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "ticker_live_overrides" (
      "id" serial PRIMARY KEY,
      "competition_id" integer REFERENCES "competitions"("id") ON DELETE SET NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      "custom_slides" jsonb,
      "priority" integer NOT NULL DEFAULT 0,
      "label" varchar(200),
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ ticker_live_overrides");

  await sql`CREATE INDEX IF NOT EXISTS "ticker_overrides_comp_idx" ON "ticker_live_overrides"("competition_id")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "ticker_custom_upcoming" (
      "id" serial PRIMARY KEY,
      "text" varchar(300) NOT NULL,
      "date" varchar(10),
      "href" varchar(500),
      "display_until" varchar(10),
      "created_at" timestamp NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ ticker_custom_upcoming");

  // 0007: extend ticker_live_overrides with type + href
  await sql`ALTER TABLE "ticker_live_overrides" ADD COLUMN IF NOT EXISTS "type" varchar(20) NOT NULL DEFAULT 'live'`;
  await sql`ALTER TABLE "ticker_live_overrides" ADD COLUMN IF NOT EXISTS "href" varchar(500)`;
  console.log("✓ ticker_live_overrides extended");

  await sql.end();
  console.log("Migration complete.");
}

main().catch(e => { console.error("Error:", e.message, e.cause ?? ""); process.exit(1); });
