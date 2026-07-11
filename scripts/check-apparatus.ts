import { config } from "dotenv";
import postgres from "../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js";

config({ path: ".env.local" });
const url = process.env.DATABASE_URL!;

async function main() {
  const sql = (postgres as unknown as (url: string, opts: object) => ReturnType<typeof postgres>)(url, { ssl: "require", max: 1 });

  // Check column exists
  const cols = await sql`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'shooters' AND column_name = 'apparatus'
  `;
  console.log("Column info:", cols);

  // Try the exact failing query
  const count = await sql`
    SELECT COUNT(*)::int FROM "shooters"
    WHERE "shooters"."apparatus" IN ('air_rifle','air_pistol','rifle','pistol')
  `;
  console.log("Count:", count);

  await sql.end();
}

main().catch((e) => { console.error("DB error:", e.message); process.exit(1); });
