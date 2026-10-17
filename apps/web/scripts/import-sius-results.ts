// Jednokratni uvoz SIUS rezultata za takmičenja koja već imaju scius_id (vidi link-sius-events.ts).
// Dry-run po defaultu; upis tek sa --commit.  Uključuje i mešane timove (ARMT/APMT).
//   pnpm --filter @shootermarkt/web db:import-sius [-- --commit] [--comp=123] [--from=2025-01-01]
import { and, gte, isNotNull, lte, eq } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { commitImportReview } from "@/lib/import-commit";
import { commitMixedTeamsDirect } from "@/lib/import-commit-mixed";
import { buildSiusImport, mergeSiusFinals, SiusImportError } from "@/lib/sius-import";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const commit = process.argv.includes("--commit");
const compId = arg("comp");
const from = arg("from") ?? `${new Date().getFullYear() - 1}-01-01`;

async function main() {
  const comps = await db
    .select({ id: competitions.id, name: competitions.name, date: competitions.date, siusId: competitions.siusId })
    .from(competitions)
    .where(compId
      ? eq(competitions.id, Number(compId))
      : and(isNotNull(competitions.siusId), gte(competitions.date, from), lte(competitions.date, new Date().toISOString().slice(0, 10))))
    .orderBy(competitions.date);
  console.log(`${comps.length} takmičenja sa SIUS UUID-om${commit ? "" : "  (DRY-RUN)"}\n`);

  let totalRows = 0, failed = 0;
  for (const c of comps) {
    if (!c.siusId) { console.log(`[${c.id}] ${c.name}: nema scius_id`); continue; }
    process.stdout.write(`[${c.id}] ${String(c.date).slice(0, 10)} ${c.name} ... `);
    try {
      const data = await buildSiusImport(c.siusId);
      const rows = mergeSiusFinals(data.rows, data.finalEntries);
      const perDisc = new Map<string, number>();
      for (const r of rows) perDisc.set(r.disciplineCode, (perDisc.get(r.disciplineCode) ?? 0) + 1);
      const newShooters = rows.filter((r) => !r.shooterId).length;
      console.log(`${rows.length} redova [${[...perDisc].map(([k, v]) => `${k}:${v}`).join(" ")}], timova: ${data.teamEntries.length}, novih strelaca: ${newShooters}${data.errors.length ? `, upozorenja: ${data.errors.join("; ")}` : ""}`);
      totalRows += rows.length;
      if (commit && data.teamEntries.length) {
        const mixed = await commitMixedTeamsDirect(c.id, data.teamEntries);
        console.log(`    mešani timovi: upisano ${mixed.inserted}, preskočeno ${mixed.skipped}${mixed.errors.length ? `, greške: ${mixed.errors.slice(0, 5).join("; ")}` : ""}`);
      }
      if (commit && rows.length) {
        const res = await commitImportReview({ source: "sius_import", competitionId: c.id, rows });
        console.log(`    upisano ${res.inserted}, preskočeno ${res.skipped}${res.errors.length ? `, greške: ${res.errors.slice(0, 5).join("; ")}` : ""}`);
      }
    } catch (e) {
      failed++;
      console.log(e instanceof SiusImportError ? `${e.status}: ${e.message}` : `GREŠKA: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\nUkupno redova: ${totalRows}, neuspelih takmičenja: ${failed}${commit ? "" : "\nDry-run. Dodaj --commit za upis."}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
