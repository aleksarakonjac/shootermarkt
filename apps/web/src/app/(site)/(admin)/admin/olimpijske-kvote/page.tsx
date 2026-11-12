import { db } from "@shootermarkt/db";
import { competitions, olympicQuotaAllocations, olympicQuotas, results } from "@shootermarkt/db/schema";
import { and, asc, count, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { CompetitionQuotas, type QuotaCandidate, type QuotaCompetitionRow } from "./competition-quotas";
import { OtherQuotasManager } from "./other-quotas-manager";

export const metadata = { title: "Admin · Olimpijske kvote" };
export const dynamic = "force-dynamic";

// Kvalifikacioni period za LA 2028: od 31. jula 2026. do 1. maja 2028.
const WINDOW_FROM = "2026-07-31";
const WINDOW_TO = "2028-05-01";

export default async function OlympicQuotasAdminPage() {
  const [allocationRows, awardedRows, candidateRows] = await Promise.all([
    db
      .select({ id: competitions.id, name: competitions.name, nameSr: competitions.nameSr, date: competitions.date, dateEnd: competitions.dateEnd, location: competitions.location, level: competitions.level, places: olympicQuotaAllocations.places })
      .from(olympicQuotaAllocations)
      .innerJoin(competitions, eq(competitions.id, olympicQuotaAllocations.competitionId))
      .where(eq(olympicQuotaAllocations.games, "LA2028"))
      .orderBy(asc(competitions.date)),
    db
      .select({ competitionId: results.competitionId, awarded: count() })
      .from(olympicQuotas)
      .innerJoin(results, eq(results.id, olympicQuotas.resultId))
      .where(eq(olympicQuotas.games, "LA2028"))
      .groupBy(results.competitionId),
    db
      .select({ id: competitions.id, name: competitions.name, nameSr: competitions.nameSr, date: competitions.date, location: competitions.location })
      .from(competitions)
      .where(and(inArray(competitions.level, ["world", "continental", "olympic"]), gte(competitions.date, WINDOW_FROM), lte(competitions.date, WINDOW_TO), isNotNull(competitions.issfId)))
      .orderBy(asc(competitions.date)),
  ]);

  const awardedBy = new Map(awardedRows.map((r) => [r.competitionId, r.awarded]));
  const byId = new Map<number, QuotaCompetitionRow>();
  for (const r of allocationRows) {
    const row = byId.get(r.id) ?? { id: r.id, name: r.nameSr ?? r.name, date: r.date, dateEnd: r.dateEnd, location: r.location, level: r.level, places: 0, awarded: awardedBy.get(r.id) ?? 0 };
    row.places += r.places;
    byId.set(r.id, row);
  }
  const rows = [...byId.values()];
  const candidates: QuotaCandidate[] = candidateRows.filter((c) => !byId.has(c.id)).map((c) => ({ id: c.id, name: c.nameSr ?? c.name, date: c.date, location: c.location }));

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="mb-1 font-[family-name:var(--font-barlow-condensed)] text-2xl font-bold uppercase text-[var(--ink)]">Olimpijske kvote · LA 2028</h1>
        <p className="text-sm text-[var(--muted)]">
          Na jednom mestu: kvote sa takmičenja (broj mesta po disciplini i dodela strelaca), a ispod rang-lista, domaćin i univerzalna mesta.
        </p>
      </div>
      <CompetitionQuotas competitions={rows} candidates={candidates} />
      <OtherQuotasManager />
    </div>
  );
}
