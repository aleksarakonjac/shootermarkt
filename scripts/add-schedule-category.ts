import { config } from "dotenv";
import postgres from "../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
console.log("Connecting to:", url.slice(0, 50) + "...");

async function main() {
  const sql = (postgres as unknown as (url: string, opts: object) => ReturnType<typeof postgres>)(url!, { ssl: "require", max: 1 });

  console.log("Altering competition_schedule table to add category column...");

  await sql`
    ALTER TABLE "competition_schedule" 
    ADD COLUMN IF NOT EXISTS "category" "age_category" NOT NULL DEFAULT 'senior';
  `;
  console.log("✓ Added category column with default 'senior'");

  await sql.end();
  console.log("Migration complete.");
}

main().catch(e => { console.error("Error:", e.message, e.cause ?? ""); process.exit(1); });
