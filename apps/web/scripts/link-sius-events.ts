// Interaktivno povezivanje takmičenja iz baze sa SIUS (SCloud) takmičenjima: upisuje competitions.scius_id.
// Pokretanje: pnpm --filter @shootermarkt/web db:link-sius        (prošla + tekuća godina)
// Automatski: -- --auto (dry-run, ispis predloga) pa -- --auto --commit (upisuje samo sigurna poklapanja; ostala preskače).
// Redosled: ENTER = prihvati predlog, 1-5 = izaberi drugog kandidata, u = nalepi UUID, s = preskoči, q = kraj.
import { createInterface } from "node:readline/promises";
import { and, gte, isNull, eq } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { fetchSiusCompetitions } from "@shootermarkt/adapters/sius/public-adapter";
import { rankSiusCandidates } from "@/lib/sius-match";

const FROM = `${new Date().getFullYear() - 1}-01-01`;
const auto = process.argv.includes("--auto");
const commit = process.argv.includes("--commit");
// Sigurno poklapanje: dovoljan skor, jasna prednost nad drugim kandidatom, SIUS UUID nije već zauzet.
const MIN_SCORE = 0.5;
const MIN_MARGIN = 0.2;

async function main() {
  const sius = await fetchSiusCompetitions(FROM);
  console.log(`SIUS: ${sius.length} javnih takmičenja od ${FROM}`);

  const dbComps = await db
    .select({ id: competitions.id, name: competitions.name, date: competitions.date, location: competitions.location })
    .from(competitions)
    .where(and(isNull(competitions.siusId), gte(competitions.date, FROM)))
    .orderBy(competitions.date);
  const linked = new Set((await db.select({ s: competitions.siusId }).from(competitions)).map((r) => r.s).filter(Boolean));
  console.log(`Baza: ${dbComps.length} takmičenja bez SIUS UUID-a. Već povezanih SIUS UUID-ova: ${linked.size}\n`);

  const rl = auto ? null : createInterface({ input: process.stdin, output: process.stdout });
  let done = 0, skipped = 0, noCand = 0;

  for (const c of dbComps) {
    const date = String(c.date).slice(0, 10);
    const cands = rankSiusCandidates({ name: c.name, date, location: c.location }, sius).slice(0, 5);
    if (!cands.length) { noCand++; continue; }

    if (auto) {
      const [best, second] = cands;
      const safe = best.score >= MIN_SCORE && (!second || best.score - second.score >= MIN_MARGIN) && !linked.has(best.s.id);
      const tag = safe ? (commit ? "POVEZANO" : "BI POVEZAO") : "PREGLED ";
      console.log(`${tag} [${c.id}] ${date} ${c.name}  →  ${best.s.start} ${best.s.name} (${best.s.city ?? "-"}) skor ${best.score.toFixed(2)}${second ? ` / drugi ${second.score.toFixed(2)}` : ""}`);
      if (!safe) { skipped++; continue; }
      if (commit) {
        try { await db.update(competitions).set({ siusId: best.s.id }).where(eq(competitions.id, c.id)); linked.add(best.s.id); done++; }
        catch (e) { console.log(`  ✗ greška: ${e instanceof Error ? e.message : e}`); }
      } else { linked.add(best.s.id); done++; }
      continue;
    }

    console.log(`\n[${c.id}] ${date}  ${c.name}  (${c.location ?? "-"})`);
    cands.forEach(({ s }, i) =>
      console.log(`  ${i + 1}) ${s.start}  ${s.name} — ${s.city ?? "-"}, ${s.country ?? "-"}  ${s.id}${linked.has(s.id) ? "  [VEĆ POVEZAN]" : ""}`));

    const ans = (await rl!.question(`  ENTER=1 | 1-${cands.length} | u=UUID | s=preskoči | q=kraj > `)).trim().toLowerCase();
    if (ans === "q") break;
    if (ans === "s") { skipped++; continue; }

    let pick: string | undefined;
    if (ans === "" ) pick = cands[0].s.id;
    else if (ans === "u") pick = (await rl!.question("  UUID: ")).trim();
    else if (/^[1-5]$/.test(ans) && cands[Number(ans) - 1]) pick = cands[Number(ans) - 1].s.id;
    if (!pick) { console.log("  neprepoznato, preskačem"); skipped++; continue; }
    if (linked.has(pick) && (await rl!.question("  UUID je već povezan sa drugim takmičenjem. Svejedno? (y/N) ")).trim().toLowerCase() !== "y") { skipped++; continue; }

    try {
      await db.update(competitions).set({ siusId: pick }).where(eq(competitions.id, c.id));
      linked.add(pick); done++;
      console.log("  ✓ povezano");
    } catch (e) {
      console.log(`  ✗ greška: ${e instanceof Error ? e.message : e}`); // npr. unique constraint
    }
  }

  rl?.close();
  console.log(`\n${auto && !commit ? "Dry-run (dodaj --commit). Bi povezao" : "Povezano"}: ${done}, preskočeno: ${skipped}, bez kandidata: ${noCand}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
