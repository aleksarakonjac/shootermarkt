import { db } from "@/lib/db";
import { clubs, competitionSchedule, competitions, countries, disciplines, results, shooterFormaCache, shooters, tickerLiveOverrides } from "@/lib/db/schema";
import { RANKING_MIN_SAMPLE } from "@/lib/forma";
import { buildCompetitionScopeFilter, type Scope } from "@/lib/scope";
import { getTickerSlotEnd, isTickerSlotLive } from "@/lib/ticker-schedule";
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";

const DISC_CODES = ["ARM", "ARW", "APM", "APW"] as const;
const MAX_SCORE_BY_DISCIPLINE: Record<string, number> = { ARM: 654, ARW: 654, APM: 600, APW: 600 };

export function selectTickerUpcoming<T extends { date: string }>(competitions: T[], today: string) {
  const deadline = new Date(`${today}T00:00:00Z`);
  deadline.setUTCDate(deadline.getUTCDate() + 14);
  const withinTwoWeeks = competitions.filter((competition) => competition.date > today && competition.date <= deadline.toISOString().slice(0, 10)).slice(0, 8);
  return withinTwoWeeks.length ? withinTwoWeeks : competitions.filter((competition) => competition.date > today).slice(0, 3);
}

export function isCompetitionLive(date: string, dateEnd: string | null, today: string) {
  return date <= today && (dateEnd ?? date) >= today;
}

export function groupTopFormaScores(rows: Array<{ shooterId: number; discCode: string; qualTotal: string | number | null }>) {
  const scores = new Map<string, number[]>();
  for (const row of rows) {
    if (row.qualTotal == null) continue;
    const key = `${row.shooterId}:${row.discCode}`;
    scores.set(key, [...(scores.get(key) ?? []), Number(row.qualTotal)]);
  }
  return scores;
}

type TickerScheduleSlot = { discCode: string; stage: string; startTime: Date; endTime: Date | null };

export function getTickerScheduleState<T extends TickerScheduleSlot>(slots: T[], now: Date) {
  const active = slots.filter((slot) => isTickerSlotLive(slot, now)).sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0] ?? null;
  const next = slots.filter((slot) => slot.startTime > now).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0] ?? null;
  const lastCompleted = slots.filter((slot) => { const end = getTickerSlotEnd(slot); return end != null && end < now; }).sort((a, b) => (getTickerSlotEnd(b)?.getTime() ?? 0) - (getTickerSlotEnd(a)?.getTime() ?? 0))[0] ?? null;
  return { active, next, lastCompleted };
}

function tickerStageLabel(stage: string, locale: string) {
  const labels: Record<string, [string, string]> = {
    qual: ["Kvalifikacije", "Qualification"], qual_precision: ["Precizna paljba", "Precision"], qual_rapid: ["Brza paljba", "Rapid fire"], elimination: ["Eliminacije", "Elimination"], final: ["Finale", "Final"],
  };
  return (labels[stage] ?? [stage, stage])[locale === "en" ? 1 : 0];
}

function tickerTime(date: Date, locale: string) {
  return date.toLocaleTimeString(locale === "en" ? "en-GB" : "sr-Latn-RS", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Belgrade" });
}

export function formatTickerNextTime(date: Date, now: Date, locale: string) {
  const dateKey = (value: Date) => value.toLocaleDateString("sv-SE", { timeZone: "Europe/Belgrade" });
  const toUtc = (key: string) => new Date(`${key}T00:00:00Z`).getTime();
  const dayDiff = Math.round((toUtc(dateKey(date)) - toUtc(dateKey(now))) / 86_400_000);
  const time = tickerTime(date, locale);
  if (dayDiff === 0) return time;
  if (dayDiff === 1) return locale === "en" ? `tomorrow at ${time}` : `sutra u ${time}`;
  if (dayDiff < 7) return `${date.toLocaleDateString(locale === "en" ? "en-GB" : "sr-Latn-RS", { weekday: "long", timeZone: "Europe/Belgrade" })} ${locale === "en" ? "at" : "u"} ${time}`;
  return `${date.toLocaleDateString(locale === "en" ? "en-GB" : "sr-Latn-RS", { day: "numeric", month: "short", timeZone: "Europe/Belgrade" })} ${locale === "en" ? "at" : "u"} ${time}`;
}

function tickerCountdown(date: Date, now: Date, locale: string) {
  const minutes = Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return locale === "en" ? `in ${minutes} min` : `za ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return locale === "en" ? `in ${hours}h${rest ? ` ${rest}m` : ""}` : `za ${hours} h${rest ? ` ${rest} min` : ""}`;
}

export async function getHomepageTicker(scope: Scope, locale: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const fields = { id: competitions.id, name: competitions.name, nameSr: competitions.nameSr, nameEn: competitions.nameEn, date: competitions.date, dateEnd: competitions.dateEnd, level: competitions.level, location: competitions.location, countryCode2: countries.code2, nocCode: countries.nocCode };
  const scopeFilter = buildCompetitionScopeFilter(scope);
  const [liveRows, futureRows, activeOverrides] = await Promise.all([
    db.select(fields).from(competitions).leftJoin(countries, eq(competitions.countryId, countries.id)).where(and(sql`${competitions.date} <= ${today} AND COALESCE(${competitions.dateEnd}, ${competitions.date}) >= ${today}`, scopeFilter)).orderBy(competitions.date),
    db.select(fields).from(competitions).leftJoin(countries, eq(competitions.countryId, countries.id)).where(and(sql`${competitions.date} > ${today}`, scopeFilter)).orderBy(competitions.date).limit(8),
    db.select({ type: tickerLiveOverrides.type, competitionId: tickerLiveOverrides.competitionId }).from(tickerLiveOverrides).where(eq(tickerLiveOverrides.isActive, true)),
  ]);
  const liveIds = liveRows.map((competition) => competition.id);

  // Fetch competition data for active overrides that reference a competition not already live
  const overrideCompIds = activeOverrides.map((o) => o.competitionId).filter((id): id is number => id != null && !liveIds.includes(id));
  const overrideComps = overrideCompIds.length
    ? await db.select(fields).from(competitions).leftJoin(countries, eq(competitions.countryId, countries.id)).where(inArray(competitions.id, overrideCompIds))
    : [];

  const [slots, resultRows] = liveIds.length ? await Promise.all([
    db.select({ competitionId: competitionSchedule.competitionId, disciplineId: competitionSchedule.disciplineId, discCode: disciplines.code, stage: competitionSchedule.stage, category: competitionSchedule.category, startTime: competitionSchedule.startTime, endTime: competitionSchedule.endTime }).from(competitionSchedule).innerJoin(disciplines, eq(competitionSchedule.disciplineId, disciplines.id)).where(inArray(competitionSchedule.competitionId, liveIds)).orderBy(asc(competitionSchedule.startTime)),
    db.select({ competitionId: results.competitionId, disciplineId: results.disciplineId, category: results.category, firstName: shooters.firstName, lastName: shooters.lastName, qualTotal: results.qualTotal, qualRank: results.qualRank, finalTotal: results.finalTotal, finalRank: results.finalRank }).from(results).innerJoin(shooters, eq(results.shooterId, shooters.id)).where(inArray(results.competitionId, liveIds)),
  ]) : [[], []] as const;
  const topThree = (slot: typeof slots[number] | null) => {
    if (!slot) return null;
    const isFinal = slot.stage === "final" || slot.stage === "elimination";
    const ranked = resultRows.filter((row) => row.competitionId === slot.competitionId && row.disciplineId === slot.disciplineId && row.category === slot.category && (isFinal ? row.finalRank != null && row.finalTotal != null : row.qualRank != null && row.qualTotal != null)).sort((a, b) => Number(isFinal ? a.finalRank : a.qualRank) - Number(isFinal ? b.finalRank : b.qualRank)).slice(0, 3);
    if (!ranked.length) return null;
    return ranked.map((row, index) => `${index + 1}. ${row.lastName} ${Number(isFinal ? row.finalTotal : row.qualTotal).toFixed(slot.discCode.startsWith("AP") ? 0 : 1)}`).join(" · ");
  };
  const live = liveRows.map((competition) => {
    const state = getTickerScheduleState(slots.filter((slot) => slot.competitionId === competition.id), now);
    const activePhase = state.active && `${state.active.discCode} · ${tickerStageLabel(state.active.stage, locale)}`;
    const completedPhase = state.lastCompleted && `${state.lastCompleted.discCode} · ${tickerStageLabel(state.lastCompleted.stage, locale)}`;
    const nextPhase = state.next && `${state.next.discCode} · ${tickerStageLabel(state.next.stage, locale)} · ${formatTickerNextTime(state.next.startTime, now, locale)} (${tickerCountdown(state.next.startTime, now, locale)})`;
    const activeTopThree = topThree(state.active);
    const completedTopThree = topThree(state.lastCompleted);
    const detailItems = state.active
      ? [{ label: locale === "en" ? "NOW" : "U TOKU", text: activePhase! }, ...(activeTopThree ? [{ label: "TOP 3", text: activeTopThree }] : [])]
      : [
          ...(nextPhase ? [{ label: locale === "en" ? "NEXT" : "SLEDEĆE", text: nextPhase }] : []),
          ...(completedPhase && completedTopThree ? [{ label: locale === "en" ? "RESULTS" : "REZULTATI", text: `${completedPhase} · ${completedTopThree}` }] : []),
        ];
    return { ...competition, name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name), detailItems, forceStatus: null as "LIVE" | "USKORO" | null };
  });

  // Inject forced overrides (competitions not currently live) into the live array
  for (const override of activeOverrides) {
    if (!override.competitionId) continue;
    if (liveIds.includes(override.competitionId)) continue; // real live comp already in array
    const comp = overrideComps.find((c) => c.id === override.competitionId);
    if (!comp) continue;
    const forceStatus = override.type === "live" ? "LIVE" : override.type === "uskoro" ? "USKORO" : null;
    if (!forceStatus) continue;
    live.push({ ...comp, name: locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name), detailItems: [], forceStatus });
  }

  const liveIdSet = new Set(live.map((c) => c.id));
  const filteredFuture = futureRows.filter((c) => !liveIdSet.has(c.id));
  return { today, live, upcoming: selectTickerUpcoming(filteredFuture, today).map((competition) => ({ ...competition, name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name) })) };
}

export async function getHomepageMain(scope: Scope) {
  const today = new Date().toISOString().slice(0, 10);
  const twoMonthsOut = new Date(`${today}T00:00:00Z`);
  twoMonthsOut.setUTCMonth(twoMonthsOut.getUTCMonth() + 2);
  const upcomingDeadline = twoMonthsOut.toISOString().slice(0, 10);
  const competitionScope = buildCompetitionScopeFilter(scope);
  const nationalityFilter = scope === 'srb' ? eq(shooters.nationality, 'SRB') : undefined;
  const activeFirst = sql`CASE WHEN ${competitions.date} <= ${today} AND COALESCE(${competitions.dateEnd}, ${competitions.date}) >= ${today} THEN 1 ELSE 0 END`;
  const [recentComps, cacheRows, upcoming] = await Promise.all([
    db.select().from(competitions).where(and(sql`${competitions.date} <= ${today}`, competitionScope)).orderBy(desc(activeFirst), desc(competitions.date)).limit(3),
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
    return { ...competition, isLive: isCompetitionLive(competition.date, competition.dateEnd, today), discResults };
  }));
  const topByDisc = Object.fromEntries(DISC_CODES.map((code) => [code, cacheRows.filter((row) => row.discCode === code).sort((a, b) => Number(b.forma) - Number(a.forma)).slice(0, 5)])) as Record<typeof DISC_CODES[number], typeof cacheRows>;
  const ids = [...new Set(Object.values(topByDisc).flat().map((row) => row.shooterId))];
  const scoreRows = ids.length
    ? await db.select({ shooterId: results.shooterId, discCode: disciplines.code, qualTotal: results.qualTotal })
      .from(results)
      .innerJoin(competitions, eq(results.competitionId, competitions.id))
      .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .where(and(inArray(results.shooterId, ids), inArray(disciplines.code, [...DISC_CODES]), isNotNull(results.qualTotal)))
      .orderBy(desc(competitions.date))
    : [];
  const scores = groupTopFormaScores(scoreRows);
  const map = (row: (typeof cacheRows)[number]) => ({ shooterId: row.shooterId, firstName: row.firstName, lastName: row.lastName, clubName: row.clubName, nationality: row.nationality, formaScore: Number(row.forma), trend: row.trend ?? "stable", peak: row.peakCareer == null ? null : Number(row.peakCareer), entriesCount: row.sampleSize, recentScores: scores.get(`${row.shooterId}:${row.discCode}`) ?? [] });
  return { recent, upcoming, topForma: { ARM: topByDisc.ARM.map(map), ARW: topByDisc.ARW.map(map), APM: topByDisc.APM.map(map), APW: topByDisc.APW.map(map) } };
}

export async function getHomepageClubs(scope: Scope) {
  const nationalityFilter = scope === 'srb' ? eq(shooters.nationality, 'SRB') : undefined;
  const rows = await db.select({ clubId: shooters.clubId, clubName: clubs.name, clubCity: clubs.city, discCode: shooterFormaCache.disciplineCode, forma: shooterFormaCache.forma }).from(shooterFormaCache).innerJoin(shooters, eq(shooterFormaCache.shooterId, shooters.id)).innerJoin(clubs, eq(shooters.clubId, clubs.id)).where(and(eq(shooters.verified, true), nationalityFilter, gte(shooterFormaCache.sampleSize, RANKING_MIN_SAMPLE), isNotNull(shooterFormaCache.forma)));
  const grouped = new Map<number, { name: string; city: string | null; scores: number[] }>();
  for (const row of rows) if (row.clubId) { const club = grouped.get(row.clubId) ?? { name: row.clubName, city: row.clubCity, scores: [] }; club.scores.push((Number(row.forma) / (MAX_SCORE_BY_DISCIPLINE[row.discCode] ?? 630)) * 100); grouped.set(row.clubId, club); }
  return Array.from(grouped.entries()).map(([clubId, club]) => ({ clubId, name: club.name, city: club.city, avgPct: Math.round((club.scores.reduce((sum, value) => sum + value, 0) / club.scores.length) * 10) / 10, activeShooters: club.scores.length })).sort((a, b) => b.avgPct - a.avgPct).slice(0, 5);
}
