import { db } from "@shootermarkt/db";
import { clubs, competitionSchedule, competitions, countries, disciplines, mixedTeamResults, results, shooterFormaCache, shooters, tickerCustomUpcoming, tickerLiveOverrides } from "@shootermarkt/db/schema";
import { displayNoc, NOC_LIST } from "@shootermarkt/db/noc-list";
import { rankedFormaCacheFilter } from "@/lib/forma-query";
import { buildCompetitionScopeFilter, type Scope } from "@/lib/scope";
import { getTickerSlotEnd, isTickerSlotLive } from "@/lib/ticker-schedule";
import { splitDisplayName } from "@shootermarkt/adapters/sius/public-adapter";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

const FORMA_DISC_CODES = ["ARM", "ARW", "APM", "APW"] as const;

type HomepagePhaseCandidate = {
  discCode: string;
  stage: string;
  isLive: boolean;
  hasSrb: boolean;
  startTime: Date;
  endTime: Date | null;
};

function comparePhaseRecency(a: HomepagePhaseCandidate, b: HomepagePhaseCandidate) {
  if (a.isLive !== b.isLive) return Number(b.isLive) - Number(a.isLive);
  const aTime = a.isLive ? a.startTime.getTime() : (getTickerSlotEnd(a)?.getTime() ?? a.startTime.getTime());
  const bTime = b.isLive ? b.startTime.getTime() : (getTickerSlotEnd(b)?.getTime() ?? b.startTime.getTime());
  return bTime - aTime;
}

function hasCurrentSrbPriority(phase: HomepagePhaseCandidate, now: Date) {
  if (!phase.hasSrb) return false;
  const dateKey = (value: Date) => value.toLocaleDateString("sv-SE", { timeZone: "Europe/Belgrade" });
  const toUtc = (key: string) => new Date(`${key}T00:00:00Z`).getTime();
  const dayDiff = Math.round((toUtc(dateKey(now)) - toUtc(dateKey(phase.startTime))) / 86_400_000);
  return dayDiff === 0 || dayDiff === 1;
}

export function selectHomepageCurrentPhases<T extends HomepagePhaseCandidate>(phases: T[], scope: Scope, now = new Date()) {
  const selected = phases
    .toSorted((a, b) => {
      if (a.isLive !== b.isLive) return Number(b.isLive) - Number(a.isLive);
      const aSrbPriority = hasCurrentSrbPriority(a, now);
      const bSrbPriority = hasCurrentSrbPriority(b, now);
      if (scope === "srb" && aSrbPriority !== bSrbPriority) return Number(bSrbPriority) - Number(aSrbPriority);
      return comparePhaseRecency(a, b);
    })
    .slice(0, 4);
  return selected.toSorted(comparePhaseRecency);
}

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
export type TickerStatus = "LIVE" | "USKORO" | "NEXT" | "NEUTRAL" | "REVIEW";

export function getTickerScheduleState<T extends TickerScheduleSlot>(slots: T[], now: Date) {
  const active = slots.filter((slot) => isTickerSlotLive(slot, now)).sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0] ?? null;
  const next = slots.filter((slot) => slot.startTime > now).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0] ?? null;
  const lastCompleted = slots.filter((slot) => { const end = getTickerSlotEnd(slot); return end != null && end < now; }).sort((a, b) => (getTickerSlotEnd(b)?.getTime() ?? 0) - (getTickerSlotEnd(a)?.getTime() ?? 0))[0] ?? null;
  return { active, next, lastCompleted };
}

export function getTickerScheduleStatus(
  state: { active: TickerScheduleSlot | null; next: TickerScheduleSlot | null; lastCompleted: TickerScheduleSlot | null },
  now: Date,
): TickerStatus {
  if (state.active) return "LIVE";
  if (state.next) return state.next.startTime.getTime() - now.getTime() <= 20 * 60_000 ? "USKORO" : "NEXT";
  return state.lastCompleted ? "REVIEW" : "NEUTRAL";
}

function tickerStagePriority(stage: string) {
  if (stage === "final") return 0;
  if (stage.startsWith("qual")) return 1;
  if (stage === "elimination") return 2;
  return 3;
}

export function selectTickerCompletedSlots<T extends { stage: string }>(slots: T[], hasResults: (slot: T) => boolean, getKey: (slot: T) => string) {
  const seen = new Set<string>();
  return slots.filter(hasResults).sort((a, b) => tickerStagePriority(a.stage) - tickerStagePriority(b.stage)).filter((slot) => !seen.has(getKey(slot)) && (seen.add(getKey(slot)), true));
}

// Sort order for stacking a discipline's phases within one homepage card:
// qualification always precedes elimination, elimination precedes final.
function stageOrder(stage: string): number {
  if (stage.startsWith("qual")) return 0;
  if (stage === "elimination") return 1;
  return 2;
}

type HomepageDisplayEntry = { id: string; nationality: string | null };
type HomepageDisplayPhase<T extends HomepageDisplayEntry> = { stage: string; top3: T[]; srbHighlights: T[] };

export function selectHomepageDisplayPhases<T extends HomepageDisplayEntry, P extends HomepageDisplayPhase<T>>(phases: P[], scope: Scope): P[] {
  if (!phases.some((phase) => phase.stage.startsWith("qual"))) return phases;

  const standardPhases = phases.filter((phase) => phase.stage !== "elimination");
  if (scope !== "srb") return standardPhases;

  const qualificationIds = new Set(
    phases
      .filter((phase) => phase.stage.startsWith("qual"))
      .flatMap((phase) => [...phase.top3, ...phase.srbHighlights].map((entry) => entry.id)),
  );
  const eliminationHighlight = phases
    .filter((phase) => phase.stage === "elimination")
    .flatMap((phase) => [...phase.top3, ...phase.srbHighlights])
    .filter((entry) => entry.nationality === "SRB" && !qualificationIds.has(entry.id));

  if (!eliminationHighlight.length) return standardPhases;
  const elimination = phases.find((phase) => phase.stage === "elimination")!;
  return [...standardPhases, { ...elimination, top3: [], srbHighlights: eliminationHighlight } as P];
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
  const [liveRows, futureRows, activeOverrides, customUpcomingRows] = await Promise.all([
    db.select(fields).from(competitions).leftJoin(countries, eq(competitions.countryId, countries.id)).where(and(sql`${competitions.date} <= ${today} AND COALESCE(${competitions.dateEnd}, ${competitions.date}) >= ${today}`, scopeFilter)).orderBy(competitions.date),
    db.select(fields).from(competitions).leftJoin(countries, eq(competitions.countryId, countries.id)).where(and(sql`${competitions.date} > ${today}`, scopeFilter)).orderBy(competitions.date).limit(8),
    db.select({ type: tickerLiveOverrides.type, competitionId: tickerLiveOverrides.competitionId, label: tickerLiveOverrides.label, href: tickerLiveOverrides.href, customSlides: tickerLiveOverrides.customSlides }).from(tickerLiveOverrides).where(eq(tickerLiveOverrides.isActive, true)),
    db.select().from(tickerCustomUpcoming).where(or(isNull(tickerCustomUpcoming.displayUntil), gte(tickerCustomUpcoming.displayUntil, today))),
  ]);
  const liveIds = liveRows.map((competition) => competition.id);

  // Fetch competition data for active overrides that reference a competition not already live
  const overrideCompIds = activeOverrides
    .filter((override) => override.type === "live" || override.type === "uskoro")
    .map((override) => override.competitionId)
    .filter((id): id is number => id != null && !liveIds.includes(id));
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
    return ranked.map((row, index) => `${index + 1}. ${row.lastName} ${Number(isFinal ? row.finalTotal : row.qualTotal).toFixed(!isFinal && slot.discCode.startsWith("AP") ? 0 : 1)}`).join(" · ");
  };
  const live = liveRows.map((competition) => {
    const competitionSlots = slots.filter((slot) => slot.competitionId === competition.id);
    const state = getTickerScheduleState(competitionSlots, now);
    const tickerStatus = getTickerScheduleStatus(state, now);
    const activePhase = state.active && `${state.active.discCode} · ${tickerStageLabel(state.active.stage, locale)}`;
    const completedSlots = selectTickerCompletedSlots(
      competitionSlots.filter((slot) => { const end = getTickerSlotEnd(slot); return end != null && end < now; }).sort((a, b) => (getTickerSlotEnd(b)?.getTime() ?? 0) - (getTickerSlotEnd(a)?.getTime() ?? 0)),
      (slot) => topThree(slot) != null,
      (slot) => slot.discCode,
    ).slice(0, 3);
    const nextPhase = state.next && `${state.next.discCode} · ${tickerStageLabel(state.next.stage, locale)} · ${formatTickerNextTime(state.next.startTime, now, locale)} (${tickerCountdown(state.next.startTime, now, locale)})`;
    const activeTopThree = topThree(state.active);
    const detailItems = state.active
      ? [{ label: locale === "en" ? "NOW" : "U TOKU", text: activePhase! }, ...(activeTopThree ? [{ label: "TOP 3", text: activeTopThree }] : [])]
      : [
          ...(nextPhase ? [{ label: locale === "en" ? "NEXT" : "SLEDEĆE", text: nextPhase }] : []),
          ...completedSlots.map((slot) => ({ text: `${slot.discCode} · ${tickerStageLabel(slot.stage, locale)} · ${topThree(slot)!}`, status: "REVIEW" as const })),
        ];
    const linkedItems = activeOverrides
      .filter((override) => override.type === "linked" && override.competitionId === competition.id)
      .map((override) => ({
        label: override.label ?? (locale === "en" ? "RELATED" : "VEZANO"),
        text: override.customSlides?.[0]?.text ?? override.label ?? "",
        href: override.href ?? undefined,
      }))
      .filter((item) => item.text);
    return { ...competition, name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name), detailItems: [...detailItems, ...linkedItems], forceStatus: null as "LIVE" | "USKORO" | null, tickerStatus };
  });

  // Inject forced overrides (competitions not currently live) into the live array
  for (const override of activeOverrides) {
    if (!override.competitionId) continue;
    if (liveIds.includes(override.competitionId)) continue; // real live comp already in array
    const comp = overrideComps.find((c) => c.id === override.competitionId);
    if (!comp) continue;
    const forceStatus = override.type === "live" ? "LIVE" : override.type === "uskoro" ? "USKORO" : null;
    if (!forceStatus) continue;
    live.push({ ...comp, name: locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name), detailItems: [], forceStatus, tickerStatus: forceStatus });
  }

  const liveIdSet = new Set(live.map((c) => c.id));
  const filteredFuture = futureRows.filter((c) => !liveIdSet.has(c.id));
  const futureUpcoming = selectTickerUpcoming(filteredFuture, today).map((competition) => ({
    id: competition.id,
    name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name),
    date: competition.date,
    level: competition.level,
    location: competition.location,
    href: `/takmicenja/${competition.id}`,
  }));
  const customUpcoming = customUpcomingRows
    .filter((row) => !row.date || row.date > today)
    .map((row) => ({ id: -row.id, name: row.text, date: row.date ?? today, level: "custom", location: null, href: row.href }));
  const upcoming = [...futureUpcoming, ...customUpcoming].sort((a, b) => a.date.localeCompare(b.date));
  return { today, live, upcoming };
}

export async function getHomepageMain(scope: Scope) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const twoMonthsOut = new Date(`${today}T00:00:00Z`);
  twoMonthsOut.setUTCMonth(twoMonthsOut.getUTCMonth() + 2);
  const upcomingDeadline = twoMonthsOut.toISOString().slice(0, 10);
  const competitionScope = buildCompetitionScopeFilter(scope);
  const nationalityFilter = scope === 'srb' ? eq(shooters.nationality, 'SRB') : undefined;
  const activeFirst = sql`CASE WHEN ${competitions.date} <= ${today} AND COALESCE(${competitions.dateEnd}, ${competitions.date}) >= ${today} THEN 1 ELSE 0 END`;
  const [recentComps, cacheRows, upcoming] = await Promise.all([
    db.select().from(competitions).where(and(sql`${competitions.date} <= ${today}`, competitionScope)).orderBy(desc(activeFirst), desc(competitions.date)).limit(3),
    db.select({ shooterId: shooterFormaCache.shooterId, discCode: shooterFormaCache.disciplineCode, forma: shooterFormaCache.forma, trend: shooterFormaCache.trend, sampleSize: shooterFormaCache.sampleSize, peakCareer: shooterFormaCache.peakCareer, firstName: shooters.firstName, lastName: shooters.lastName, clubName: clubs.name, nationality: shooters.nationality }).from(shooterFormaCache).innerJoin(shooters, eq(shooterFormaCache.shooterId, shooters.id)).leftJoin(clubs, eq(shooters.clubId, clubs.id)).where(and(eq(shooters.verified, true), nationalityFilter, rankedFormaCacheFilter())),
    db.select().from(competitions).where(and(sql`${competitions.date} >= ${today} AND ${competitions.date} < ${upcomingDeadline}`, competitionScope)).orderBy(asc(competitions.date)).limit(10),
  ]);
  const showSrbHighlight = scope === 'srb';
  const recent = await Promise.all(recentComps.map(async (competition) => {
    const [slots, individualRows, mixedRows] = await Promise.all([
      db.select({ discCode: disciplines.code, disciplineId: competitionSchedule.disciplineId, stage: competitionSchedule.stage, category: competitionSchedule.category, startTime: competitionSchedule.startTime, endTime: competitionSchedule.endTime }).from(competitionSchedule).innerJoin(disciplines, eq(competitionSchedule.disciplineId, disciplines.id)).where(eq(competitionSchedule.competitionId, competition.id)),
      db.select({ shooterId: results.shooterId, disciplineId: results.disciplineId, category: results.category, firstName: shooters.firstName, lastName: shooters.lastName, clubName: clubs.name, nationality: shooters.nationality, countryCode2: countries.code2, elimRank: results.elimRank, elimTotal: results.elimTotal, qualRank: results.qualRank, qualTotal: results.qualTotal, finalRank: results.finalRank, finalTotal: results.finalTotal }).from(results).innerJoin(shooters, eq(results.shooterId, shooters.id)).leftJoin(clubs, eq(results.clubId, clubs.id)).leftJoin(countries, eq(countries.nocCode, shooters.nationality)).where(eq(results.competitionId, competition.id)),
      db.select({ disciplineId: mixedTeamResults.disciplineId, nocCode: mixedTeamResults.nocCode, countryCode2: countries.code2, shooter1Name: mixedTeamResults.shooter1Name, shooter2Name: mixedTeamResults.shooter2Name, qualRank: mixedTeamResults.qualRank, qualTotal: mixedTeamResults.qualTotal, finalRank: mixedTeamResults.finalRank, finalTotal: mixedTeamResults.finalTotal }).from(mixedTeamResults).leftJoin(countries, eq(countries.nocCode, mixedTeamResults.nocCode)).where(eq(mixedTeamResults.competitionId, competition.id)),
    ]);
    type Entry = { id: string; firstName: string; lastName: string; clubName: string | null; nationality: string | null; countryCode2: string | null; rank: number; total: number };
    // A discipline/category can have multiple "qual" schedule rows at different
    // times (e.g. SPW: precizna + brza paljba are separate time slots but share
    // one combined qual ranking) — collapse to one slot per (discipline,
    // category, stage-kind) so the same phase isn't rendered twice.
    const dedupedSlots = [...new Map(
      slots.map((s) => [`${s.disciplineId}|${s.category}|${s.stage.startsWith("qual") ? "qual" : s.stage}`, s])
    ).values()];
    const rawPhases = dedupedSlots.flatMap((slot) => {
      const isLive = isTickerSlotLive(slot, new Date());
      const stageKind = slot.stage.startsWith("qual") ? "qual" : slot.stage;
      const individual = individualRows.flatMap((row): Entry[] => {
        if (row.disciplineId !== slot.disciplineId || row.category !== slot.category) return [];
        const rank = stageKind === "elimination" ? row.elimRank : stageKind === "final" ? row.finalRank : row.qualRank;
        const total = stageKind === "elimination" ? row.elimTotal : stageKind === "final" ? row.finalTotal : row.qualTotal;
        const nationality = displayNoc(row.nationality);
        return rank != null && total != null ? [{ id: `shooter:${row.shooterId}`, firstName: row.firstName, lastName: row.lastName, clubName: row.clubName ?? null, nationality, countryCode2: nationality === "AIN" ? "AIN" : row.countryCode2 ?? null, rank, total: Number(total) }] : [];
      });
      const mixed = stageKind === "elimination" ? [] : mixedRows.flatMap((row): Entry[] => {
        if (row.disciplineId !== slot.disciplineId) return [];
        const rank = stageKind === "final" ? row.finalRank : row.qualRank;
        const total = stageKind === "final" ? row.finalTotal : row.qualTotal;
        const names = [row.shooter1Name, row.shooter2Name]
          .filter((name): name is string => Boolean(name))
          .map((name) => {
            const { firstName, lastName } = splitDisplayName(name);
            return firstName ? `${lastName} ${firstName.charAt(0)}.` : lastName;
          })
          .join(" / ");
        return rank != null && total != null ? [{ id: `team:${row.nocCode}:${names}`, firstName: "", lastName: names || row.nocCode, clubName: null, nationality: row.nocCode, countryCode2: row.countryCode2 ?? NOC_LIST.find((country) => country.noc === row.nocCode)?.alpha2 ?? null, rank, total: Number(total) }] : [];
      });
      const entries = [...individual, ...mixed].sort((a, b) => a.rank - b.rank);
      if (!entries.length || (!isLive && (getTickerSlotEnd(slot) == null || getTickerSlotEnd(slot)! >= new Date()))) return [];
      const top3 = entries.slice(0, 3);
      const shown = new Set(top3.map((entry) => entry.id));
      const srbHighlights = showSrbHighlight ? entries.filter((entry) => entry.nationality === "SRB" && !shown.has(entry.id)) : [];
      return [{ ...slot, isLive, hasSrb: entries.some((entry) => entry.nationality === "SRB"), discCode: slot.discCode, stage: slot.stage, isJunior: slot.category !== "senior", top3, srbHighlights }];
    });

    // One discipline (senior vs junior counted separately) is one homepage
    // item — qual/elimination/final all stack inside it instead of each
    // phase competing separately for one of the top-4 slots.
    const phaseGroups = new Map<string, typeof rawPhases>();
    for (const phase of rawPhases) {
      const key = `${phase.discCode}|${phase.isJunior}`;
      phaseGroups.set(key, [...(phaseGroups.get(key) ?? []), phase]);
    }
    const groups = [...phaseGroups.values()].map((phases) => {
      // The group's newest/current phase determines its position; Serbian
      // relevance is applied only when choosing the four displayed groups.
      const representative = phases.toSorted(comparePhaseRecency)[0];
      return {
        discCode: representative.discCode,
        stage: representative.stage,
        isJunior: representative.isJunior,
        isLive: phases.some((p) => p.isLive),
        hasSrb: phases.some((p) => p.hasSrb),
        startTime: representative.startTime,
        endTime: representative.endTime,
        phases: [...phases].sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage)),
      };
    });
    const discResults = selectHomepageCurrentPhases(groups, scope, now).map((group) => {
      // Once qualification results exist, elimination is redundant except for a
      // Serbian shooter who appeared in E but has no qualification result.
      const visiblePhases = selectHomepageDisplayPhases(group.phases, scope);
      return {
      discCode: group.discCode,
      isJunior: group.isJunior,
      isLive: group.isLive,
      phases: visiblePhases.map((phase) => ({
        stage: phase.stage,
        category: phase.category,
        isLive: phase.isLive,
        qualTop3: phase.top3.map(({ firstName, lastName, clubName, nationality, countryCode2, total, rank }) => ({ firstName, lastName, clubName, nationality, countryCode2, qualTotal: total, qualRank: rank, finalTotal: null, finalRank: null })),
        srbHighlights: phase.srbHighlights.map(({ firstName, lastName, clubName, total, rank }) => ({ firstName, lastName, clubName, qualRank: rank, qualTotal: total, finalRank: null, finalTotal: null })),
      })),
      };
    });
    return { ...competition, isLive: isCompetitionLive(competition.date, competition.dateEnd, today), discResults };
  }));
  const topByDisc = Object.fromEntries(FORMA_DISC_CODES.map((code) => [code, cacheRows.filter((row) => row.discCode === code).sort((a, b) => Number(b.forma) - Number(a.forma)).slice(0, 5)])) as Record<typeof FORMA_DISC_CODES[number], typeof cacheRows>;
  const ids = [...new Set(Object.values(topByDisc).flat().map((row) => row.shooterId))];
  const scoreRows = ids.length
    ? await db.select({ shooterId: results.shooterId, discCode: disciplines.code, qualTotal: results.qualTotal })
      .from(results)
      .innerJoin(competitions, eq(results.competitionId, competitions.id))
      .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .where(and(inArray(results.shooterId, ids), inArray(disciplines.code, [...FORMA_DISC_CODES]), isNotNull(results.qualTotal)))
      .orderBy(desc(competitions.date))
    : [];
  const scores = groupTopFormaScores(scoreRows);
  const map = (row: (typeof cacheRows)[number]) => ({ shooterId: row.shooterId, firstName: row.firstName, lastName: row.lastName, clubName: row.clubName, nationality: row.nationality, formaScore: Number(row.forma), trend: row.trend ?? "stable", peak: row.peakCareer == null ? null : Number(row.peakCareer), entriesCount: row.sampleSize, recentScores: scores.get(`${row.shooterId}:${row.discCode}`) ?? [] });
  return { recent, upcoming, topForma: { ARM: topByDisc.ARM.map(map), ARW: topByDisc.ARW.map(map), APM: topByDisc.APM.map(map), APW: topByDisc.APW.map(map) } };
}

export type HomepageMainData = Awaited<ReturnType<typeof getHomepageMain>>;

export async function getHomepageClubs(scope: Scope) {
  const nationalityFilter = scope === 'srb' ? eq(shooters.nationality, 'SRB') : undefined;
  const rows = await db.select({ clubId: shooters.clubId, clubName: clubs.name, clubCity: clubs.city, discCode: shooterFormaCache.disciplineCode, forma: shooterFormaCache.forma }).from(shooterFormaCache).innerJoin(shooters, eq(shooterFormaCache.shooterId, shooters.id)).innerJoin(clubs, eq(shooters.clubId, clubs.id)).where(and(eq(shooters.verified, true), nationalityFilter, rankedFormaCacheFilter()));

  // forma svih strelaca po disciplini (rastuce sortirano) — baza za percentil, spaja discipline u jedan unit-less broj
  const disciplineValues = new Map<string, number[]>();
  for (const row of rows) { const arr = disciplineValues.get(row.discCode) ?? []; arr.push(Number(row.forma)); disciplineValues.set(row.discCode, arr); }
  for (const arr of disciplineValues.values()) arr.sort((a, b) => a - b);
  const percentileOf = (discCode: string, value: number) => {
    const arr = disciplineValues.get(discCode)!;
    if (arr.length <= 1) return 100;
    let lo = 0, hi = arr.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < value) lo = mid + 1; else hi = mid; }
    return (lo / (arr.length - 1)) * 100;
  };

  const grouped = new Map<number, { name: string; city: string | null; percentiles: number[] }>();
  for (const row of rows) if (row.clubId) { const club = grouped.get(row.clubId) ?? { name: row.clubName, city: row.clubCity, percentiles: [] }; club.percentiles.push(percentileOf(row.discCode, Number(row.forma))); grouped.set(row.clubId, club); }
  return Array.from(grouped.entries()).map(([clubId, club]) => ({ clubId, name: club.name, city: club.city, avgPercentile: Math.round((club.percentiles.reduce((sum, value) => sum + value, 0) / club.percentiles.length) * 10) / 10, activeShooters: club.percentiles.length })).sort((a, b) => b.avgPercentile - a.avgPercentile).slice(0, 5);
}
