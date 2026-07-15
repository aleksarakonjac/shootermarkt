import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubs, competitions, shooters } from "@/lib/db/schema";
import { MVP_APPARATUS } from "@/lib/mvp-scope";
import { buildCompetitionScopeFilter, buildShooterScopeFilter, DEFAULT_SCOPE, type Scope, VALID_SCOPES } from "@/lib/scope";

const LIMIT = 5;

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const requestedScope = request.nextUrl.searchParams.get("scope");
  const scope: Scope = VALID_SCOPES.includes(requestedScope as Scope) ? requestedScope as Scope : DEFAULT_SCOPE;
  const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "sr";
  const shootersOnly = request.nextUrl.searchParams.get("only") === "shooters";

  if (q.length < 2) return NextResponse.json({ shooters: [], competitions: [] });

  const terms = q.split(/\s+/).filter(Boolean);
  const shooterMatches = terms.map((term) => or(
    ilike(shooters.firstName, `${term}%`),
    ilike(shooters.lastName, `${term}%`),
  ));
  const competitionMatches = terms.map((term) => or(
    ilike(competitions.name, `${term}%`),
    ilike(competitions.nameSr, `${term}%`),
    ilike(competitions.nameEn, `${term}%`),
  ));

  const [shooterRows, competitionRows] = await Promise.all([
    shootersOnly
      ? Promise.resolve([])
      : db
      .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, clubName: clubs.name, avatarUrl: shooters.avatarUrl })
      .from(shooters)
      .leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .where(and(eq(shooters.verified, true), inArray(shooters.apparatus, [...MVP_APPARATUS]), buildShooterScopeFilter(scope), ...shooterMatches))
      .orderBy(shooters.lastName, shooters.firstName)
      .limit(LIMIT),
    db
      .select({ id: competitions.id, name: competitions.name, nameSr: competitions.nameSr, nameEn: competitions.nameEn, date: competitions.date, level: competitions.level })
      .from(competitions)
      .where(and(buildCompetitionScopeFilter(scope), ...competitionMatches))
      .orderBy(competitions.date)
      .limit(LIMIT),
  ]);

  return NextResponse.json({
    shooters: shooterRows,
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
