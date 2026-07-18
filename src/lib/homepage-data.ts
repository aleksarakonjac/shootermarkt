import { db } from "@/lib/db";
import { clubs, competitions, countries, disciplines, results, shooterFormaCache, shooters } from "@/lib/db/schema";
import { RANKING_MIN_SAMPLE } from "@/lib/forma";
import { buildCompetitionScopeFilter, type Scope } from "@/lib/scope";
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";

const DISC_CODES = ["ARM", "ARW", "APM", "APW"] as const;
const MAX_SCORE_BY_DISCIPLINE: Record<string, number> = { ARM: 654, ARW: 654, APM: 600, APW: 600 };

export async function getHomepageTicker(scope: Scope, locale: string) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select({ id: competitions.id, name: competitions.name, nameSr: competitions.nameSr, nameEn: competitions.nameEn, date: competitions.date, level: competitions.level, location: competitions.location, countryCode2: countries.code2, nocCode: countries.nocCode }).from(competitions).leftJoin(countries, eq(competitions.countryId, countries.id)).where(and(sql`${competitions.date} >= ${today}`, buildCompetitionScopeFilter(scope))).orderBy(competitions.date).limit(8);
  const live = await Promise.all(rows.filter((competition) => competition.date === today).map(async (competition) => {
    const best = await db.select({ qualTotal: results.qualTotal, lastName: shooters.lastName, discCode: disciplines.code }).from(results).innerJoin(shooters, eq(results.shooterId, shooters.id)).innerJoin(disciplines, eq(results.disciplineId, disciplines.id)).where(and(eq(results.competitionId, competition.id), scope === 'srb' ? eq(shooters.nationality, 'SRB') : undefined)).orderBy(desc(results.qualTotal)).limit(1);
    return { ...competition, name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name), best: best[0] ?? null };
  }));
  return { today, live, upcoming: rows.filter((competition) => competition.date > today).map((competition) => ({ ...competition, name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name) })) };
}

export async function getHomepageMain(scope: Scope) {
  const today = new Date().toISOString().slice(0, 10);
  const competitionScope = buildCompetitionScopeFilter(scope);
  const nationalityFilter = scope === 'srb' ? eq(shooters.nationality, 'SRB') : undefined;
  const [recentComps, cacheRows, upcoming] = await Promise.all([
    db.select().from(competitions).where(competitionScope).orderBy(desc(competitions.date)).limit(3),
    db.select({ shooterId: shooterFormaCache.shooterId, discCode: shooterFormaCache.disciplineCode, forma: shooterFormaCache.forma, trend: shooterFormaCache.trend, sampleSize: shooterFormaCache.sampleSize, peakCareer: shooterFormaCache.peakCareer, firstName: shooters.firstName, lastName: shooters.lastName, clubName: clubs.name, nationality: shooters.nationality }).from(shooterFormaCache).innerJoin(shooters, eq(shooterFormaCache.shooterId, shooters.id)).leftJoin(clubs, eq(shooters.clubId, clubs.id)).where(and(eq(shooters.verified, true), nationalityFilter, gte(shooterFormaCache.sampleSize, RANKING_MIN_SAMPLE), isNotNull(shooterFormaCache.forma))),
    db.select().from(competitions).where(and(sql`${competitions.date} >= ${today}`, competitionScope)).orderBy(asc(competitions.date)).limit(10),
  ]);
  const recent = await Promise.all(recentComps.map(async (competition) => {
    const winner = await db.select({ qualTotal: results.qualTotal, firstName: shooters.firstName, lastName: shooters.lastName, clubName: clubs.name, discCode: disciplines.code }).from(results).innerJoin(shooters, eq(results.shooterId, shooters.id)).leftJoin(clubs, eq(shooters.clubId, clubs.id)).innerJoin(disciplines, eq(results.disciplineId, disciplines.id)).where(and(eq(results.competitionId, competition.id), nationalityFilter)).orderBy(desc(results.qualTotal)).limit(1);
    return { ...competition, winner: winner[0] ?? null };
  }));
  const topByDisc = Object.fromEntries(DISC_CODES.map((code) => [code, cacheRows.filter((row) => row.discCode === code).sort((a, b) => Number(b.forma) - Number(a.forma)).slice(0, 5)])) as Record<typeof DISC_CODES[number], typeof cacheRows>;
  const ids = [...new Set(Object.values(topByDisc).flat().map((row) => row.shooterId))];
  const scoreRows = ids.length ? await db.select({ shooterId: results.shooterId, qualTotal: results.qualTotal }).from(results).where(and(inArray(results.shooterId, ids), isNotNull(results.qualTotal))) : [];
  const scores = new Map<number, number[]>();
  for (const row of scoreRows) scores.set(row.shooterId, [...(scores.get(row.shooterId) ?? []), Number(row.qualTotal)]);
  const map = (row: (typeof cacheRows)[number]) => ({ shooterId: row.shooterId, firstName: row.firstName, lastName: row.lastName, clubName: row.clubName, nationality: row.nationality, formaScore: Number(row.forma), trend: row.trend ?? "stable", peak: row.peakCareer == null ? null : Number(row.peakCareer), entriesCount: row.sampleSize, recentScores: scores.get(row.shooterId) ?? [] });
  return { recent, upcoming, topForma: { ARM: topByDisc.ARM.map(map), ARW: topByDisc.ARW.map(map), APM: topByDisc.APM.map(map), APW: topByDisc.APW.map(map) } };
}

export async function getHomepageClubs(scope: Scope) {
  const nationalityFilter = scope === 'srb' ? eq(shooters.nationality, 'SRB') : undefined;
  const rows = await db.select({ clubId: shooters.clubId, clubName: clubs.name, clubCity: clubs.city, discCode: shooterFormaCache.disciplineCode, forma: shooterFormaCache.forma }).from(shooterFormaCache).innerJoin(shooters, eq(shooterFormaCache.shooterId, shooters.id)).innerJoin(clubs, eq(shooters.clubId, clubs.id)).where(and(eq(shooters.verified, true), nationalityFilter, gte(shooterFormaCache.sampleSize, RANKING_MIN_SAMPLE), isNotNull(shooterFormaCache.forma)));
  const grouped = new Map<number, { name: string; city: string | null; scores: number[] }>();
  for (const row of rows) if (row.clubId) { const club = grouped.get(row.clubId) ?? { name: row.clubName, city: row.clubCity, scores: [] }; club.scores.push((Number(row.forma) / (MAX_SCORE_BY_DISCIPLINE[row.discCode] ?? 630)) * 100); grouped.set(row.clubId, club); }
  return Array.from(grouped.entries()).map(([clubId, club]) => ({ clubId, name: club.name, city: club.city, avgPct: Math.round((club.scores.reduce((sum, value) => sum + value, 0) / club.scores.length) * 10) / 10, activeShooters: club.scores.length })).sort((a, b) => b.avgPct - a.avgPct).slice(0, 5);
}
