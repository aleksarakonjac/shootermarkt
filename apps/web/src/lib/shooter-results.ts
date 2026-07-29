import { and, desc, eq, gte, ilike, inArray, lte, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { competitions, countries, disciplines, results } from "@/lib/db/schema";
import type { ResultRowData } from "@/components/result-display/ResultsHistoryTable";

export const SHOOTER_RESULTS_PAGE_SIZE = 8;

export type ResultsCursor = { date: string; id: number };
export type ResultsFilters = { from?: string; to?: string; query?: string };

export async function getShooterResultsPage(shooterId: number, cursor?: ResultsCursor, filters: ResultsFilters = {}) {
  const cursorFilter = cursor && or(
    lt(competitions.date, cursor.date),
    and(eq(competitions.date, cursor.date), lt(competitions.id, cursor.id)),
  );
  const filterConditions = [
    eq(results.shooterId, shooterId),
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
  const competitionRows = await db
    .selectDistinct({ id: competitions.id, date: competitions.date })
    .from(results)
    .innerJoin(competitions, eq(results.competitionId, competitions.id))
    .where(and(...filterConditions))
    .orderBy(desc(competitions.date), desc(competitions.id))
    .limit(SHOOTER_RESULTS_PAGE_SIZE + 1);

  const visibleCompetitions = competitionRows.slice(0, SHOOTER_RESULTS_PAGE_SIZE);
  if (!visibleCompetitions.length) return { results: [] as ResultRowData[], nextCursor: null };

  const resultRows = await db
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
    })
    .from(results)
    .innerJoin(competitions, eq(results.competitionId, competitions.id))
    .leftJoin(countries, eq(competitions.countryId, countries.id))
    .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
    .where(and(eq(results.shooterId, shooterId), inArray(competitions.id, visibleCompetitions.map((competition) => competition.id))))
    .orderBy(desc(competitions.date), desc(competitions.id), disciplines.code);

  const lastCompetition = visibleCompetitions.at(-1)!;
  return {
    results: resultRows,
    nextCursor: competitionRows.length > SHOOTER_RESULTS_PAGE_SIZE ? lastCompetition : null,
  };
}
