import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

async function main() {
  const sql = (postgres as unknown as (url: string, opts: object) => ReturnType<typeof postgres>)(url!, { ssl: "require", max: 1 });
  await sql`ALTER TABLE "shooters" ADD COLUMN IF NOT EXISTS "apparatus" varchar(6)`;
  console.log("✓ added apparatus column");
  await sql`ALTER TABLE "shooters" ALTER COLUMN "apparatus" TYPE varchar(10)`;
  console.log("✓ widened to varchar(10)");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
