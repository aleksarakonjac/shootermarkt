import { db } from "@/lib/db";
import { clubs, competitions, countries, disciplines, results, shooterFormaCache, shooters } from "@/lib/db/schema";
import { RANKING_MIN_SAMPLE } from "@/lib/forma";
import { buildCompetitionScopeFilter, type Scope } from "@/lib/scope";
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";

const DISC_CODES = ["ARM", "ARW", "APM", "APW"] as const;
const MAX_SCORE_BY_DISCIPLINE: Record<string, number> = { ARM: 654, ARW: 654, APM: 600, APW: 600 };

export function selectTickerUpcoming<T extends { date: string }>(competitions: T[], today: string) {
  const deadline = new Date(`${today}T00:00:00Z`);
  deadline.setUTCDate(deadline.getUTCDate() + 14);
  const withinTwoWeeks = competitions.filter((competition) => competition.date > today && competition.date <= deadline.toISOString().slice(0, 10)).slice(0, 8);
  return withinTwoWeeks.length ? withinTwoWeeks : competitions.filter((competition) => competition.date > today).slice(0, 3);
}

export async function getHomepageTicker(scope: Scope, locale: string) {
  const today = new Date().toISOString().slice(0, 10);
  const fields = { id: competitions.id, name: competitions.name, nameSr: competitions.nameSr, nameEn: competitions.nameEn, date: competitions.date, level: competitions.level, location: competitions.location, countryCode2: countries.code2, nocCode: countries.nocCode };
  const scopeFilter = buildCompetitionScopeFilter(scope);
  const liveRows = await db.select(fields).from(competitions).leftJoin(countries, eq(competitions.countryId, countries.id)).where(and(eq(competitions.date, today), scopeFilter)).orderBy(competitions.date);
  const futureRows = await db.select(fields).from(competitions).leftJoin(countries, eq(competitions.countryId, countries.id)).where(and(sql`${competitions.date} > ${today}`, scopeFilter)).orderBy(competitions.date).limit(8);
  const live = await Promise.all(liveRows.map(async (competition) => {
    const best = await db.select({ qualTotal: results.qualTotal, lastName: shooters.lastName, discCode: disciplines.code }).from(results).innerJoin(shooters, eq(results.shooterId, shooters.id)).innerJoin(disciplines, eq(results.disciplineId, disciplines.id)).where(and(eq(results.competitionId, competition.id), scope === 'srb' ? eq(shooters.nationality, 'SRB') : undefined)).orderBy(desc(results.qualTotal)).limit(1);
    return { ...competition, name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name), best: best[0] ?? null };
  }));
  return { today, live, upcoming: selectTickerUpcoming(futureRows, today).map((competition) => ({ ...competition, name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name) })) };
}

export async function getHomepageMain(scope: Scope) {
  const today = new Date().toISOString().slice(0, 10);
  const twoMonthsOut = new Date(`${today}T00:00:00Z`);
  twoMonthsOut.setUTCMonth(twoMonthsOut.getUTCMonth() + 2);
  const upcomingDeadline = twoMonthsOut.toISOString().slice(0, 10);
  const competitionScope = buildCompetitionScopeFilter(scope);
  const nationalityFilter = scope === 'srb' ? eq(shooters.nationality, 'SRB') : undefined;
  const [recentComps, cacheRows, upcoming] = await Promise.all([
    db.select().from(competitions).where(and(sql`${competitions.date} <= ${today}`, competitionScope)).orderBy(desc(competitions.date)).limit(3),
    db.select({ shooterId: shooterFormaCache.shooterId, discCode: shooterFormaCache.disciplineCode, forma: shooterFormaCache.forma, trend: shooterFormaCache.trend, sampleSize: shooterFormaCache.sampleSize, peakCareer: shooterFormaCache.peakCareer, firstName: shooters.firstName, lastName: shooters.lastName, clubName: clubs.name, nationality: shooters.nationality }).from(shooterFormaCache).innerJoin(shooters, eq(shooterFormaCache.shooterId, shooters.id)).leftJoin(clubs, eq(shooters.clubId, clubs.id)).where(and(eq(shooters.verified, true), nationalityFilter, gte(shooterFormaCache.sampleSize, RANKING_MIN_SAMPLE), isNotNull(shooterFormaCache.forma))),
    db.select().from(competitions).where(and(sql`${competitions.date} >= ${today} AND ${competitions.date} < ${upcomingDeadline}`, competitionScope)).orderBy(asc(competitions.date)).limit(10),
  ]);
  const recent = await Promise.all(recentComps.map(async (competition) => {
    // ponytail: fetches all qualifying rows per competition (bounded by event size); result is cached
    const rows = await db.select({ discCode: disciplines.code, category: results.category, firstName: shooters.firstName, lastName: shooters.lastName, clubName: clubs.name, nationality: shooters.nationality, countryCode2: countries.code2, qualTotal: results.qualTotal, finalTotal: results.finalTotal, finalRank: results.finalRank }).from(results).innerJoin(shooters, eq(results.shooterId, shooters.id)).leftJoin(clubs, eq(shooters.clubId, clubs.id)).leftJoin(countries, eq(countries.nocCode, shooters.nationality)).innerJoin(disciplines, eq(results.disciplineId, disciplines.id)).where(and(eq(results.competitionId, competition.id), isNotNull(results.qualTotal), inArray(disciplines.code, [...DISC_CODES]), nationalityFilter)).orderBy(asc(disciplines.code), desc(results.qualTotal)).limit(200);
    type DE = { firstName: string; lastName: string; clubName: string | null; nationality: string | null; countryCode2: string | null; qualTotal: number; finalTotal: number | null; finalRank: number | null };
    const preferredCat = new Map<string, string>();
    for (const row of rows) { const cur = preferredCat.get(row.discCode); if (!cur || (row.category === 'senior' && cur !== 'senior')) preferredCat.set(row.discCode, row.category); }
    const qualMap = new Map<string, DE[]>();
    const finalMap = new Map<string, DE[]>();
    for (const row of rows) {
      const cat = preferredCat.get(row.discCode);
      if (row.category !== cat) continue;
      const entry: DE = { firstName: row.firstName, lastName: row.lastName, clubName: row.clubName ?? null, nationality: row.nationality ?? null, countryCode2: row.countryCode2 ?? null, qualTotal: parseFloat(row.qualTotal!), finalTotal: row.finalTotal != null ? parseFloat(row.finalTotal) : null, finalRank: row.finalRank };
      const qual = qualMap.get(row.discCode) ?? [];
      if (qual.length < 3) { qual.push(entry); qualMap.set(row.discCode, qual); }
      if (row.finalRank != null && row.finalRank >= 1 && row.finalRank <= 3) { const fins = finalMap.get(row.discCode) ?? []; fins.push(entry); finalMap.set(row.discCode, fins); }
    }
    for (const [, fins] of finalMap) fins.sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99));
    const discResults = DISC_CODES.map((code) => { const cat = preferredCat.get(code); if (!cat) return null; const qualTop3 = qualMap.get(code) ?? []; const finalTop3 = finalMap.get(code) ?? []; if (qualTop3.length === 0 && finalTop3.length === 0) return null; return { discCode: code, isJunior: cat !== 'senior', category: cat, hasFinale: finalTop3.length > 0, qualTop3, finalTop3 }; }).filter((x): x is NonNullable<typeof x> => x !== null);
    return { ...competition, discResults };
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
