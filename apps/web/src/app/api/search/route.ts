import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { clubs, competitionEvents, competitions, results, shooterFormaCache, shooters } from "@shootermarkt/db/schema";
import { matchedPreviousLastName, shooterNameLike } from "@/lib/previous-last-name";
import { RANKING_ACTIVE_DAYS, rankedFormaCacheFilter } from "@/lib/forma-query";
import { MVP_APPARATUS } from "@/lib/mvp-scope";
import { buildCompetitionScopeFilter, DEFAULT_SCOPE, type Scope, VALID_SCOPES } from "@/lib/scope";

const SHOOTER_LIMIT = 20;
const SHOOTER_ONLY_LIMIT = 50;
const COMPETITION_LIMIT = 5;

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const requestedScope = request.nextUrl.searchParams.get("scope");
  const scope: Scope = VALID_SCOPES.includes(requestedScope as Scope) ? requestedScope as Scope : DEFAULT_SCOPE;
  const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "sr";
  const shootersOnly = request.nextUrl.searchParams.get("only") === "shooters";

  if (q.length < 2) return NextResponse.json({ shooters: [], competitions: [] });

  const terms = q.split(/\s+/).filter(Boolean);
  const shooterMatches = terms.map((term) => shooterNameLike(term, "prefix"));
  const lastResultDate = sql<string | null>`(
    select max(coalesce(${competitionEvents.date}, ${competitions.date})) from ${results}
    join ${competitions} on ${competitions.id} = ${results.competitionId}
    left join ${competitionEvents} on ${competitionEvents.id} = ${results.competitionEventId}
    where ${results.shooterId} = ${shooters.id}
  )`;
  // Najbolji percentil (0 = prvi) u nekoj disciplini javne rang liste; NULL = nije rangiran.
  // Subquery + join (ne korelisani subquery): window se računa jednom, ne po kandidatu.
  const rankedRows = db
    .select({
      shooterId: shooterFormaCache.shooterId,
      pct: sql<number>`percent_rank() over (partition by ${shooterFormaCache.disciplineCode} order by ${shooterFormaCache.forma} desc)`.as("pct"),
    })
    .from(shooterFormaCache)
    .where(rankedFormaCacheFilter())
    .as("ranked_rows");
  const bestRank = db
    .select({ shooterId: rankedRows.shooterId, pct: sql<number>`min(${rankedRows.pct})`.as("best_pct") })
    .from(rankedRows)
    .groupBy(rankedRows.shooterId)
    .as("best_rank");

  const competitionMatches = terms.map((term) => or(
    // Početak bilo koje reči naziva ("kup" → "Masped Kup").
    ...[competitions.name, competitions.nameSr, competitions.nameEn].flatMap((column) => [
      ilike(column, `${term}%`),
      ilike(column, `% ${term}%`),
    ]),
    ilike(competitions.location, `%${term}%`),
  ));

  const shooterQuery = db
    .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, previousLastNames: shooters.previousLastNames, clubName: clubs.name, avatarUrl: shooters.avatarUrl })
    .from(shooters)
    .leftJoin(clubs, eq(shooters.clubId, clubs.id))
    .leftJoin(bestRank, eq(bestRank.shooterId, shooters.id))
    .where(and(eq(shooters.verified, true), inArray(shooters.apparatus, [...MVP_APPARATUS]), ...shooterMatches))
    .orderBy(
      // Način poklapanja (ime / prezime / ranije prezime) ne utiče na redosled — odlučuju aktivnost i rang.
      // Na srpskom sajtu domaći strelci uvek ispred stranih.
      ...(scope === "srb" ? [sql`(${shooters.nationality} = 'SRB') desc nulls last`] : []),
      sql`(${lastResultDate} >= to_char(current_date - ${RANKING_ACTIVE_DAYS}::int, 'YYYY-MM-DD')) desc nulls last`,
      sql`${bestRank.pct} asc nulls last`,
      sql`${lastResultDate} desc nulls last`,
      shooters.lastName,
      shooters.firstName,
    )
    .limit(shootersOnly ? SHOOTER_ONLY_LIMIT : SHOOTER_LIMIT);

  const competitionQuery = db
    .select({ id: competitions.id, name: competitions.name, nameSr: competitions.nameSr, nameEn: competitions.nameEn, date: competitions.date, level: competitions.level })
    .from(competitions)
    .where(and(buildCompetitionScopeFilter(scope), ...competitionMatches))
    // U toku i predstojeća (najbliža prvo), pa prošla od najnovijeg.
    .orderBy(
      sql`(coalesce(${competitions.dateEnd}, ${competitions.date}) >= to_char(current_date, 'YYYY-MM-DD')) desc`,
      sql`case when coalesce(${competitions.dateEnd}, ${competitions.date}) >= to_char(current_date, 'YYYY-MM-DD') then ${competitions.date} end asc`,
      sql`${competitions.date} desc`,
    )
    .limit(COMPETITION_LIMIT);

  const [shooterRows, competitionRows] = await Promise.all([
    // Upit bez slova (npr. samo interpunkcija) nema po čemu da traži strelce.
    shooterMatches.some(Boolean) ? shooterQuery : Promise.resolve([]),
    shootersOnly ? Promise.resolve([]) : competitionQuery,
  ]);

  return NextResponse.json({
    shooters: shooterRows.map(({ previousLastNames, ...s }) => ({
      ...s,
      matchedLastName: matchedPreviousLastName(q, s.firstName, s.lastName, previousLastNames),
    })),
    competitions: competitionRows.map((competition) => ({
      id: competition.id,
      name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name),
      date: competition.date,
      level: competition.level,
    })),
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      "Server-Timing": `search-db;dur=${(performance.now() - startedAt).toFixed(1)}`,
    },
  });
}
