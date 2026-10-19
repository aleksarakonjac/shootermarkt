// Jednokratni uvoz SIUS rezultata za takmičenja koja već imaju scius_id (vidi link-sius-events.ts).
// Dry-run po defaultu; upis tek sa --commit.  Uključuje i mešane timove (ARMT/APMT).
//   pnpm --filter @shootermarkt/web db:import-sius [-- --commit] [--comp=123] [--from=2024 --to=2026]
import { and, gte, isNotNull, lte, eq } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { SiusImportError } from "@/lib/sius-import";
import { importSiusCompetition, type SiusImportResult, type SiusImportSummary } from "@/lib/sius-bulk";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const commit = process.argv.includes("--commit");
const compId = arg("comp");
const THIS_YEAR = new Date().getFullYear();
// --from=GODINA --to=GODINA (podrazumevano: prošla i tekuća godina)
const FROM_YEAR = Number(arg("from") ?? THIS_YEAR - 1);
const TO_YEAR = Number(arg("to") ?? THIS_YEAR);
if (!Number.isInteger(FROM_YEAR) || !Number.isInteger(TO_YEAR) || FROM_YEAR > TO_YEAR) throw new Error("Neispravan --from/--to (godine, from <= to)");
const from = `${FROM_YEAR}-01-01`;
const to = `${TO_YEAR}-12-31`;

async function main() {
  const comps = await db
    .select({ id: competitions.id, name: competitions.name, date: competitions.date, siusId: competitions.siusId })
    .from(competitions)
    .where(compId
      ? eq(competitions.id, Number(compId))
      : and(isNotNull(competitions.siusId), gte(competitions.date, from), lte(competitions.date, to < new Date().toISOString().slice(0, 10) ? to : new Date().toISOString().slice(0, 10))))
    .orderBy(competitions.date);
  console.log(`${comps.length} takmičenja sa SIUS UUID-om${commit ? "" : "  (DRY-RUN)"}\n`);

  let totalRows = 0, failed = 0;
  for (const c of comps) {
    if (!c.siusId) { console.log(`[${c.id}] ${c.name}: nema scius_id`); continue; }
    process.stdout.write(`[${c.id}] ${String(c.date).slice(0, 10)} ${c.name} ... `);
    try {
      const r: SiusImportSummary & Partial<SiusImportResult> = commit ? await importSiusCompetition(c.id, c.siusId, { commit: true }) : await importSiusCompetition(c.id, c.siusId);
      console.log(`${r.rows} redova [${Object.entries(r.perDiscipline).map(([k, v]) => `${k}:${v}`).join(" ")}], timova: ${r.teams}, novih strelaca: ${r.newShooters}, bez plasmana (DSQ/DNS): ${r.unranked}, sa kaznom/SO/rekordom: ${r.withMarks}${r.warnings.length ? `, upozorenja: ${r.warnings.join("; ")}` : ""}`);
      totalRows += r.rows;
      if (r.inserted !== undefined) {
        console.log(`    upisano ${r.inserted}, preskočeno ${r.skipped}, mešani timovi: ${r.teamsInserted}${r.errors?.length ? `, greške: ${r.errors.slice(0, 5).join("; ")}` : ""}`);
      }
    } catch (e) {
      failed++;
      console.log(e instanceof SiusImportError ? `${e.status}: ${e.message}` : `GREŠKA: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\nUkupno redova: ${totalRows}, neuspelih takmičenja: ${failed}${commit ? "" : "\nDry-run. Dodaj --commit za upis."}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
