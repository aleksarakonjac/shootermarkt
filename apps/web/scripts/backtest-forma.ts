// Backtest forme: za svaki nastup forma se računa SAMO iz ranijih nastupa (strogo raniji datum)
// i poredi sa stvarnim rezultatom. Read-only.
//   pnpm db:backtest-forma [-- --min=5]
// MAE = prosečna apsolutna greška (poena), bias = prosek (prognoza − stvarno),
// >peak+ = prognoze iznad ličnog peak-a za više od dozvoljenog dodatka, >max = iznad max_qual_score.
// Baseline "poslednji" i "prosek5" pokazuju koliko model dodaje u odnosu na naivne prognoze.
import { db } from "@shootermarkt/db";
import { disciplines } from "@shootermarkt/db/schema";
import { computeFormaFromEntries } from "@/lib/forma";
import { getFormaEntriesByDiscipline } from "@/lib/forma-query";

const minArg = process.argv.find((a) => a.startsWith("--min="))?.split("=")[1];
const MIN_PRIOR = Number(minArg ?? 5);

type Acc = { n: number; ae: number; bias: number; aeLast: number; aeAvg5: number; overPeak: number; overMax: number };
const acc = () => ({ n: 0, ae: 0, bias: 0, aeLast: 0, aeAvg5: 0, overPeak: 0, overMax: 0 });

async function main() {
  const maxByCode = new Map(
    (await db.select({ code: disciplines.code, max: disciplines.maxQualScore }).from(disciplines)).map((d) => [d.code as string, Number(d.max)])
  );
  const groups = await getFormaEntriesByDiscipline();
  const byCode = new Map<string, Acc>();

  for (const { disciplineCode, entries } of groups.values()) {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const max = maxByCode.get(disciplineCode) ?? Infinity;
    const peakBonus = max > 600 ? 1.0 : 2;
    for (let i = 1; i < sorted.length; i++) {
      const prior = sorted.filter((e) => e.date < sorted[i].date);
      if (prior.length < MIN_PRIOR) continue;
      const f = computeFormaFromEntries(prior, { code: disciplineCode }).forma;
      if (f == null) continue;
      const actual = sorted[i].qualTotal;
      const last = prior[prior.length - 1].qualTotal;
      const last5 = prior.slice(-5);
      const avg5 = last5.reduce((s, e) => s + e.qualTotal, 0) / last5.length;
      const peak = Math.max(...prior.map((e) => e.qualTotal));

      const a = byCode.get(disciplineCode) ?? acc();
      a.n++;
      a.ae += Math.abs(f - actual);
      a.bias += f - actual;
      a.aeLast += Math.abs(last - actual);
      a.aeAvg5 += Math.abs(avg5 - actual);
      if (f > peak + peakBonus) a.overPeak++;
      if (f > max) a.overMax++;
      byCode.set(disciplineCode, a);
    }
  }

  const fmt = (x: number) => x.toFixed(2);
  const rows = [...byCode.entries()].sort(([a], [b]) => a.localeCompare(b));
  const total = rows.reduce((t, [, a]) => {
    for (const k of Object.keys(t) as (keyof Acc)[]) t[k] += a[k];
    return t;
  }, acc());
  console.log(`Backtest forme — prognoze sa ≥${MIN_PRIOR} ranijih nastupa\n`);
  console.table(
    Object.fromEntries(
      [...rows, ["UKUPNO", total] as const].map(([code, a]) => [
        code,
        {
          n: a.n,
          MAE: fmt(a.ae / a.n),
          bias: fmt(a.bias / a.n),
          "MAE poslednji": fmt(a.aeLast / a.n),
          "MAE prosek5": fmt(a.aeAvg5 / a.n),
          ">peak+": a.overPeak,
          ">max": a.overMax,
        },
      ])
    )
  );
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
