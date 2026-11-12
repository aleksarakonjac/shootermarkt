import "server-only";
import { db } from "@shootermarkt/db";
import { olympicQuotaAllocations, olympicQuotas, results, shooters } from "@shootermarkt/db/schema";
import { eq, sql } from "drizzle-orm";

export const GAMES = "LA2028";

// Discipline koje ne dele olimpijske kvote: ESC solo, 300m, ležeći (prone), standardni pištolj, 25m sportski (SPM) i slobodni pištolj (FPM) za muškarce, mešoviti timovi, juniorske varijante.
export const NON_OLYMPIC = /^(SOLO|R3P300|RPR|STR300|STP|SPM|FP[MW]|ARMT|APMT|R3J)/;

/** Sve dodeljene kvote (nekoliko stotina redova najviše), i one osvojene nastupom i one dodeljene ručno (rang-lista, domaćin, univerzalnost). */
export async function allHoldings() {
  const shooterId = sql<number>`coalesce(${results.shooterId}, ${olympicQuotas.shooterId})`;
  return db
    .select({
      shooterId,
      competitionId: sql<number | null>`coalesce(${results.competitionId}, ${olympicQuotaAllocations.competitionId})`,
      disciplineId: sql<number>`coalesce(${results.disciplineId}, ${olympicQuotaAllocations.disciplineId})`,
      noc: shooters.nationality,
    })
    .from(olympicQuotas)
    .leftJoin(results, eq(results.id, olympicQuotas.resultId))
    .leftJoin(olympicQuotaAllocations, eq(olympicQuotaAllocations.id, olympicQuotas.allocationId))
    .innerJoin(shooters, eq(shooters.id, shooterId))
    .where(eq(olympicQuotas.games, GAMES));
}
export type Holding = Awaited<ReturnType<typeof allHoldings>>[number];

/** Stanje kvota jedne discipline na jednom takmičenju, izvedeno iz svih dodeljenih kvota. */
export function holdingsFor(all: Holding[], compId: number, disciplineId: number) {
  const inDiscipline = all.filter((h) => h.disciplineId === disciplineId);
  const nocCounts = new Map<string, number>();
  for (const h of inDiscipline) if (h.noc) nocCounts.set(h.noc, (nocCounts.get(h.noc) ?? 0) + 1);
  const here = inDiscipline.filter((h) => h.competitionId === compId);
  return {
    shooterIds: new Set(all.map((h) => h.shooterId)),
    nocCounts,
    eventNocCounts: here.reduce((m, h) => (h.noc ? m.set(h.noc, (m.get(h.noc) ?? 0) + 1) : m), new Map<string, number>()),
    used: here.length,
  };
}

