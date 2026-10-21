// Jednokratna popravka: HTML entiteti (&quot; &amp; ...) u competitions.name -> pravi znakovi.
// Dry-run po defaultu; upis tek sa --commit.
//   pnpm --filter @shootermarkt/web db:fix-comp-names [-- --commit]
import { sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { decodeHtmlEntities } from "@/lib/html-entities";

const commit = process.argv.includes("--commit");

async function main() {
  const rows = await db.select({ id: competitions.id, name: competitions.name }).from(competitions).where(sql`${competitions.name} ~ '&(#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z]+);'`);
  let changed = 0;
  for (const r of rows) {
    const fixed = decodeHtmlEntities(r.name).replace(/\s+/g, " ").trim();
    if (fixed === r.name) continue;
    changed++;
    console.log(`[${r.id}] ${r.name}\n     -> ${fixed}`);
    if (commit) await db.update(competitions).set({ name: fixed }).where(sql`${competitions.id} = ${r.id}`);
  }
  console.log(`\n${changed} takmičenja${commit ? " ispravljeno" : " za ispravku (DRY-RUN, dodaj --commit)"}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
