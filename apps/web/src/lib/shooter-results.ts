import { and, desc, eq, gte, ilike, inArray, lte, lt, or } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitions, competitionEvents, countries, disciplines, mixedTeamResults, results } from "@shootermarkt/db/schema";
import { isEscSoloCode } from "@shootermarkt/db/pdf-import-types";
import type { ResultRowData } from "@/components/result-display/ResultsHistoryTable";
import { getShooterMixedRows, mergeCompetitionIds, mixedForShooter } from "@/lib/shooter-mixed-results";

/** Red iz `results` → red istorije (Solo je zaseban `kind`). */
export const toIndividualHistoryRow = <T extends { id: number; disciplineCode: string }>(r: T) =>
  ({ ...r, rowKey: `r:${r.id}`, kind: isEscSoloCode(r.disciplineCode) ? "esc" as const : "individual" as const });

const SHOOTER_RESULTS_PAGE_SIZE = 8;

export type ResultsCursor = { date: string; id: number };
export type ResultsFilters = { from?: string; to?: string; query?: string };

export async function getShooterResultsPage(shooterId: number, cursor?: ResultsCursor, filters: ResultsFilters = {}) {
  const cursorFilter = cursor && or(
    lt(competitions.date, cursor.date),
    and(eq(competitions.date, cursor.date), lt(competitions.id, cursor.id)),
  );
  const filterConditions = [
    cursorFilter,
    filters.from ? gte(competitions.date, filters.from) : undefined,
    filters.to ? lte(competitions.date, filters.to) : undefined,
    filters.query ? or(
      ilike(competitions.name, `%${filters.query}%`),
      ilike(competitions.nameSr, `%${filters.query}%`),
      ilike(competitions.nameEn, `%${filters.query}%`),
      ilike(competitions.location, `%${filters.query}%`),
    ) : undefined,
  ];
  // Takmičenja iz pojedinačnih i iz mešovitih rezultata (takmičenje samo sa mešovitim timom se ne gubi).
  const [individualComps, mixedComps] = await Promise.all([
    db.selectDistinct({ id: competitions.id, date: competitions.date })
      .from(results)
      .innerJoin(competitions, eq(results.competitionId, competitions.id))
      .where(and(eq(results.shooterId, shooterId), ...filterConditions))
      .orderBy(desc(competitions.date), desc(competitions.id))
      .limit(SHOOTER_RESULTS_PAGE_SIZE + 1),
    db.selectDistinct({ id: competitions.id, date: competitions.date })
      .from(mixedTeamResults)
      .innerJoin(competitions, eq(mixedTeamResults.competitionId, competitions.id))
      .where(and(mixedForShooter(shooterId), ...filterConditions))
      .orderBy(desc(competitions.date), desc(competitions.id))
      .limit(SHOOTER_RESULTS_PAGE_SIZE + 1),
  ]);
  const competitionRows = mergeCompetitionIds(individualComps, mixedComps, SHOOTER_RESULTS_PAGE_SIZE);

  const visibleCompetitions = competitionRows.slice(0, SHOOTER_RESULTS_PAGE_SIZE);
  if (!visibleCompetitions.length) return { results: [] as ResultRowData[], nextCursor: null };

  const visibleIds = visibleCompetitions.map((competition) => competition.id);
  const [resultRows, mixedRows] = await Promise.all([db
    .select({
      id: results.id,
      category: results.category,
      qualTotal: results.qualTotal,
      qualRank: results.qualRank,
      qualInners: results.qualInners,
      qualified: results.qualified,
      elimTotal: results.elimTotal,
      elimRank: results.elimRank,
      elimRound: results.elimRound,
      elimDetail: results.elimDetail,
      finalTotal: results.finalTotal,
      finalRank: results.finalRank,
      qualDetail: results.qualDetail,
      finalDetail: results.finalDetail,
      competitionId: competitions.id,
      competitionName: competitions.name,
      competitionDate: competitions.date,
      competitionDateEnd: competitions.dateEnd,
      competitionLocation: competitions.location,
      competitionCountry: countries.name,
      competitionCountryCode2: countries.code2,
      disciplineCode: disciplines.code,
      competitionEventId: results.competitionEventId,
      eventName: competitionEvents.name,
    })
    .from(results)
    .innerJoin(competitions, eq(results.competitionId, competitions.id))
    .leftJoin(competitionEvents, eq(results.competitionEventId, competitionEvents.id))
    .leftJoin(countries, eq(competitions.countryId, countries.id))
    .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
    .where(and(eq(results.shooterId, shooterId), inArray(competitions.id, visibleIds)))
    .orderBy(desc(competitions.date), desc(competitions.id), disciplines.code),
    getShooterMixedRows(shooterId, visibleIds),
  ]);
  const order = new Map(visibleIds.map((id, index) => [id, index]));
  const rows: ResultRowData[] = [...resultRows.map(toIndividualHistoryRow), ...mixedRows]
    .sort((a, b) => order.get(a.competitionId)! - order.get(b.competitionId)!);

  const lastCompetition = visibleCompetitions.at(-1)!;
  return {
    results: rows,
    nextCursor: competitionRows.length > SHOOTER_RESULTS_PAGE_SIZE ? lastCompetition : null,
  };
}
