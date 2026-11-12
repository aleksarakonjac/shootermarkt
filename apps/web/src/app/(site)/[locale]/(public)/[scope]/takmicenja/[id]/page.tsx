export const revalidate = 86400;

import { db } from "@shootermarkt/db";
import {
  competitions, competitionEvents,
  results,
  shooters,
  clubs,
  disciplines,
  mixedTeamResults,
  competitionSchedule,
  shooterFormaCache,
  olympicQuotas,
  competitionScheduleExtras,
} from "@shootermarkt/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { ScopedLink } from "../../../components/ScopedLink";
import { CATEGORY_LABEL, CATEGORY_RANK } from "@shootermarkt/db/pdf-import-types";
import { categoryLabel, localizeMatchName } from "@/lib/match-name";
import { LEVEL_STYLE, getLevelLabel } from "@/lib/competition-utils";
import {
  CompetitionResultsClient,
  type DisciplineGroup,
} from "./CompetitionResultsClient";
import { getLocale, getTranslations } from "next-intl/server";
import { pageParams } from "@/i18n/page-params";
import { buildAlternates } from "@/i18n/alternates";
import type { Scope } from "@/lib/scope";
import { RelatedNewsSection } from "@/components/RelatedNewsSection";
import { ScheduleSection, type ScheduleExtra, type ScheduleSlot } from "./ScheduleSection";
import { foldName, foldNameSql, matchShooter } from "@shootermarkt/db/name-match";
import { splitDisplayName } from "@shootermarkt/adapters/sius/public-adapter";

type Props = { params: Promise<{ locale: string; id: string; scope: Scope }> };

// ── Metadata ─────────────────────────────────────────────────────────────────

// Jedan upit po renderu: generateMetadata i stranica dele rezultat (React cache traje jedan request).
const getCompetition = cache((id: number) => db.query.competitions.findFirst({ where: eq(competitions.id, id), with: { country: true } }));

// Prazan niz: ništa se ne prerenderuje u build-u, svaka stranica se renderuje na prvi zahtev
// i kešira (ISR, revalidate gore). Bez ovoga Next ovaj dinamički segment renderuje na svaki zahtev.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, scope } = await pageParams(params);
  const locale = await getLocale();
  const comp = /^\d{1,9}$/.test(id) ? await getCompetition(parseInt(id)) : undefined;
  const alternates = buildAlternates(locale, scope, `/takmicenja/${id}`);
  if (!comp) {
    const t = await getTranslations("competition");
    return { title: t("detail.notFound"), alternates, robots: { index: false } };
  }
  const name = locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name);
  return { title: name, alternates };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CompetitionPage({ params }: Props) {
  const { id } = await pageParams(params);
  const [locale, t, tCommon] = await Promise.all([
    getLocale(),
    getTranslations("competition"),
    getTranslations("common"),
  ]);
  const compId = parseInt(id);
  if (!/^\d{1,9}$/.test(id)) notFound();

  // Svi upiti zavise samo od compId — idu paralelno umesto jedan za drugim.
  const [comp, compResults, mixedResults, scheduleRows, quotaRows] = await Promise.all([
    getCompetition(compId),

    // Fetch all results for this competition
    db
      .select({
        id: results.id,
        shooterId: results.shooterId,
        firstName: shooters.firstName,
        lastName: shooters.lastName,
        birthYear: shooters.birthYear,
        nationality: shooters.nationality,
        avatarUrl: shooters.avatarUrl,
        clubId: results.clubId,
        clubName: clubs.name,
        clubNocCode: clubs.nocCode,
        disciplineCode: disciplines.code,
        disciplineId: disciplines.id,
        disciplineName: disciplines.name,
        apparatus: disciplines.apparatus,
        category: results.category,
        competitionEventId: results.competitionEventId,
        eventName: competitionEvents.name,
        eventDate: competitionEvents.date,
        elimRound: results.elimRound,
        elimTotal: results.elimTotal,
        elimRank: results.elimRank,
        elimDetail: results.elimDetail,
        elimRemark: results.elimRemark,
        qualTotal: results.qualTotal,
        qualRank: results.qualRank,
        qualInners: results.qualInners,
        qualified: results.qualified,
        qualDetail: results.qualDetail,
        qualRemark: results.qualRemark,
        finalTotal: results.finalTotal,
        finalRank: results.finalRank,
        finalDetail: results.finalDetail,
        finalRemark: results.finalRemark,
        remarkDetails: results.remarkDetails,
      })
      .from(results)
      .innerJoin(shooters, eq(results.shooterId, shooters.id))
      .leftJoin(clubs, eq(results.clubId, clubs.id))
      .leftJoin(competitionEvents, eq(results.competitionEventId, competitionEvents.id))
      .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .where(eq(results.competitionId, compId))
      .orderBy(asc(results.qualRank)),

    // Mixed team results
    db
      .select({
        id: mixedTeamResults.id,
        disciplineCode: disciplines.code,
        disciplineName: disciplines.name,
        apparatus: disciplines.apparatus,
        category: mixedTeamResults.category,
        nocCode: mixedTeamResults.nocCode,
        teamNumber: mixedTeamResults.teamNumber,
        shooter1Id: mixedTeamResults.shooter1Id,
        shooter2Id: mixedTeamResults.shooter2Id,
        shooter1Name: mixedTeamResults.shooter1Name,
        shooter2Name: mixedTeamResults.shooter2Name,
        shooter1Detail: mixedTeamResults.shooter1Detail,
        shooter2Detail: mixedTeamResults.shooter2Detail,
        qualRank: mixedTeamResults.qualRank,
        qualTotal: mixedTeamResults.qualTotal,
        qualInners: mixedTeamResults.qualInners,
        qualRemark: mixedTeamResults.qualRemark,
        qualified: mixedTeamResults.qualified,
        finalRank: mixedTeamResults.finalRank,
        finalTotal: mixedTeamResults.finalTotal,
        finalRemark: mixedTeamResults.finalRemark,
        remarkDetails: mixedTeamResults.remarkDetails,
        shooter1FinalDetail: mixedTeamResults.shooter1FinalDetail,
        shooter2FinalDetail: mixedTeamResults.shooter2FinalDetail,
      })
      .from(mixedTeamResults)
      .innerJoin(disciplines, eq(mixedTeamResults.disciplineId, disciplines.id))
      .where(eq(mixedTeamResults.competitionId, compId))
      .orderBy(asc(mixedTeamResults.qualRank)),

    // Fetch schedule slots
    db
      .select({
        id: competitionSchedule.id,
        disciplineCode: disciplines.code,
        stage: competitionSchedule.stage,
        category: competitionSchedule.category,
        startTime: competitionSchedule.startTime,
        endTime: competitionSchedule.endTime,
      })
      .from(competitionSchedule)
      .innerJoin(disciplines, eq(competitionSchedule.disciplineId, disciplines.id))
      .where(eq(competitionSchedule.competitionId, compId))
      .orderBy(asc(competitionSchedule.startTime)),

    // Rezultati kojima je osvojena olimpijska kvota (LA 2028)
    db
      .select({ resultId: olympicQuotas.resultId })
      .from(olympicQuotas)
      .innerJoin(results, eq(results.id, olympicQuotas.resultId))
      .where(eq(results.competitionId, compId)),
  ]);
  if (!comp) notFound();
  // Treninzi, ceremonije i ostalo iz satnice; ako tabela još ne postoji (migracija), stranica radi bez njih.
  const extraRows = await Promise.resolve(
    db
      .select({ id: competitionScheduleExtras.id, kind: competitionScheduleExtras.kind, title: competitionScheduleExtras.title, disciplineCode: disciplines.code, startTime: competitionScheduleExtras.startTime, endTime: competitionScheduleExtras.endTime })
      .from(competitionScheduleExtras)
      .leftJoin(disciplines, eq(competitionScheduleExtras.disciplineId, disciplines.id))
      .where(eq(competitionScheduleExtras.competitionId, compId))
      .orderBy(asc(competitionScheduleExtras.startTime)),
  ).catch(() => []);
  const scheduleExtras: ScheduleExtra[] = extraRows.map((r) => ({ id: r.id, kind: r.kind as ScheduleExtra["kind"], title: r.title, disciplineCode: r.disciplineCode, startTime: r.startTime.toISOString(), endTime: r.endTime?.toISOString() ?? null }));
  const quotaResultIds = new Set(quotaRows.map((q) => q.resultId));

  // SIUS import often can't match international athletes to an ISSF id at commit time —
  // fall back to a name+nation match against our shooters table so the profile link still works.
  const unmatched = mixedResults.flatMap((r) => [
    ...(!r.shooter1Id && r.shooter1Name ? [{ r, slot: 1 as const, ...splitDisplayName(r.shooter1Name) }] : []),
    ...(!r.shooter2Id && r.shooter2Name ? [{ r, slot: 2 as const, ...splitDisplayName(r.shooter2Name) }] : []),
  ]);
  if (unmatched.length) {
    // Samo kandidati sa istim fold-prezimenom (exact match to ionako zahteva), ne cela tabela.
    const candidates = await db
      .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality })
      .from(shooters)
      .where(inArray(foldNameSql(shooters.lastName), [...new Set(unmatched.map((u) => foldName(u.lastName)))]));
    for (const { r, slot, firstName, lastName } of unmatched) {
      const match = matchShooter(firstName, lastName, r.nocCode, candidates);
      if (match.kind === "exact") r[slot === 1 ? "shooter1Id" : "shooter2Id"] = match.id;
    }
  }

  // Slika i godište članova mixed timova (SIUS ih ne nosi) — iz naše tabele strelaca, kad je profil povezan.
  const mixedProfileIds = [...new Set(mixedResults.flatMap((r) => [r.shooter1Id, r.shooter2Id]).filter((id): id is number => id != null))];
  const mixedProfiles = mixedProfileIds.length
    ? await db.select({ id: shooters.id, avatarUrl: shooters.avatarUrl, birthYear: shooters.birthYear }).from(shooters).where(inArray(shooters.id, mixedProfileIds))
    : [];
  const mixedProfileById = new Map(mixedProfiles.map((p) => [p.id, p]));

  // Forma/peak/sezonski prosek iz keša — jedan upit za sve strelce takmičenja, za detail sheet.
  const shooterIds = [...new Set(compResults.map((r) => r.shooterId))];
  const formaRows = shooterIds.length
    ? await db.select({
        shooterId: shooterFormaCache.shooterId, code: shooterFormaCache.disciplineCode, forma: shooterFormaCache.forma, trend: shooterFormaCache.trend,
        peak: shooterFormaCache.peakCareer, seasonAvg: shooterFormaCache.seasonAvg, seasonCount: shooterFormaCache.seasonCount, careerCount: shooterFormaCache.careerCount,
      }).from(shooterFormaCache).where(inArray(shooterFormaCache.shooterId, shooterIds))
    : [];
  const formaByKey = Object.fromEntries(formaRows.map((f) => [`${f.shooterId}|${f.code}`, {
    forma: f.forma != null ? Number(f.forma) : null,
    trend: (f.trend as "up" | "down" | "stable" | null) ?? null,
    peak: f.peak != null ? Number(f.peak) : null,
    seasonAvg: f.seasonAvg != null ? Number(f.seasonAvg) : null,
    seasonCount: f.seasonCount,
    careerCount: f.careerCount,
  }]));

  const scheduleSlots: ScheduleSlot[] = scheduleRows.map((r) => ({
    id: r.id,
    disciplineCode: r.disciplineCode,
    stage: r.stage,
    category: r.category,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime?.toISOString() ?? null,
  }));

  // Datum meča kad ga znamo: event → raspored (početak kvalifikacija) → datum takmičenja za glavni meč višednevnog biltena
  const scheduledDate = new Map<string, string>();
  for (const slot of scheduleRows) {
    const key = `${slot.disciplineCode}|${slot.category}`;
    // dan u vremenskoj zoni takmičenja (UTC bi pomerio kasne/rane termine)
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: comp?.timezone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(slot.startTime);
    // prvi termin koji nije finale: kvalifikacije ili eliminacije (eliminacije mogu biti dan pre kvalifikacija)
    if (slot.stage !== "final" && (!scheduledDate.has(key) || day < scheduledDate.get(key)!)) scheduledDate.set(key, day);
  }

  // Group mixed team results by discipline code
  const mixedGroupOrder: string[] = [];
  const mixedGroupMap = new Map<string, { code: string; category: typeof mixedResults[number]["category"]; name: string; apparatus: string | null; date: string | null; teams: Array<typeof mixedResults[number] & { shooter1AvatarUrl: string | null; shooter2AvatarUrl: string | null; shooter1BirthYear: number | null; shooter2BirthYear: number | null }> }>();
  for (const r of mixedResults) {
    const key = `${r.disciplineCode}|${r.category}`;
    if (!mixedGroupMap.has(key)) {
      mixedGroupOrder.push(key);
      mixedGroupMap.set(key, { code: r.disciplineCode, category: r.category, name: r.disciplineName, apparatus: r.apparatus, date: scheduledDate.get(key) ?? null, teams: [] });
    }
    const p1 = r.shooter1Id != null ? mixedProfileById.get(r.shooter1Id) : undefined;
    const p2 = r.shooter2Id != null ? mixedProfileById.get(r.shooter2Id) : undefined;
    mixedGroupMap.get(key)!.teams.push({ ...r, shooter1AvatarUrl: p1?.avatarUrl ?? null, shooter2AvatarUrl: p2?.avatarUrl ?? null, shooter1BirthYear: p1?.birthYear ?? null, shooter2BirthYear: p2?.birthYear ?? null });
  }
  const mixedGroups = mixedGroupOrder.map((key) => mixedGroupMap.get(key)!);

  // Group by discipline (+ event: memorijal drugog dana / ponovljen meč je zasebna disciplina sa svojim nazivom),
  // then by age category, preserving order of first appearance. Disciplina sa više mečeva se deli i po
  // kategoriji, da svaki meč svake liste ima svoj blok ("Senior · 1. meč", "Junior · 2. meč · 25.01.").
  const multiMatch = new Set(compResults.filter((r) => r.competitionEventId).map((r) => r.disciplineCode));
  const matchDate = (r: (typeof compResults)[number]) =>
    r.eventDate ?? scheduledDate.get(`${r.disciplineCode}|${r.category}`) ?? (multiMatch.has(r.disciplineCode) ? comp?.date ?? null : null);
  const disciplineOrder: string[] = [];
  const disciplineMap = new Map<string, DisciplineGroup>();
  const categoryOrder = new Map<string, string[]>(); // group id -> category[]
  const categoryMap = new Map<string, Map<string, DisciplineGroup["categories"][number]>>();

  for (const r of compResults) {
    // isti format ključa koristi i link sa profila strelca (?disc=ARM@12)
    const selectionKey = r.competitionEventId ? `${r.disciplineCode}@${r.competitionEventId}` : r.disciplineCode;
    const split = multiMatch.has(r.disciplineCode);
    const key = split ? `${selectionKey}|${r.category}` : selectionKey;
    if (!disciplineMap.has(key)) {
      disciplineOrder.push(key);
      disciplineMap.set(key, {
        id: key,
        key: selectionKey,
        code: r.disciplineCode,
        name: r.disciplineName,
        eventName: r.eventName ?? null,
        // datum ide u svoju oznaku, pa se skida sa kraja naziva ("2. meč · 22.01." → "2. meč")
        label: localizeMatchName((split ? `${categoryLabel(r.category, CATEGORY_LABEL[r.category], locale)} · ${r.eventName ?? "1. meč"}` : r.eventName)?.replace(/ · \d{2}\.\d{2}\.$/, "") ?? "", locale) || null,
        date: matchDate(r),
        apparatus: r.apparatus,
        categories: [],
      });
      categoryOrder.set(key, []);
      categoryMap.set(key, new Map());
    }

    const catsForDiscipline = categoryOrder.get(key)!;
    const catMapForDiscipline = categoryMap.get(key)!;
    if (!catMapForDiscipline.has(r.category)) {
      catsForDiscipline.push(r.category);
      catMapForDiscipline.set(r.category, { category: r.category, results: [] });
    }

    catMapForDiscipline.get(r.category)!.results.push({
      id: r.id,
      shooterId: r.shooterId,
      firstName: r.firstName,
      lastName: r.lastName,
      birthYear: r.birthYear,
      nationality: r.nationality,
      avatarUrl: r.avatarUrl,
      clubName: r.clubName ?? null,
      clubNocCode: r.clubNocCode ?? null,
      elimRound: r.elimRound,
      elimTotal: r.elimTotal,
      elimRank: r.elimRank,
      elimDetail: r.elimDetail,
      elimRemark: r.elimRemark,
      qualTotal: r.qualTotal,
      qualRank: r.qualRank,
      qualInners: r.qualInners,
      qualified: r.qualified,
      qualDetail: r.qualDetail,
      qualRemark: r.qualRemark,
      finalTotal: r.finalTotal,
      finalRank: r.finalRank,
      finalDetail: r.finalDetail,
      finalRemark: r.finalRemark,
      remarkDetails: r.remarkDetails,
      olympicQuota: quotaResultIds.has(r.id),
    });
  }

  const groups = disciplineOrder.map((key) => {
    const catMapForDiscipline = categoryMap.get(key)!;
    const cats = categoryOrder
      .get(key)!
      .map((cat) => catMapForDiscipline.get(cat)!)
      .sort((a, b) => CATEGORY_RANK[b.category] - CATEGORY_RANK[a.category]); // stariji prvo
    return { ...disciplineMap.get(key)!, categories: cats };
  });
  // Unutar discipline (pregled ih deli po danu ili polu, pa po kodu): stariji uzrast prvo, pa glavni meč, pa ostali po nazivu/datumu
  groups.sort((a, b) =>
    CATEGORY_RANK[b.categories[0].category] - CATEGORY_RANK[a.categories[0].category]
    || Number(a.eventName != null) - Number(b.eventName != null)
    || (a.eventName ?? "").localeCompare(b.eventName ?? ""));

  // ── Date display ────────────────────────────────────────────────
  function fmtDate(d: string) {
    const [y, m, day] = d.split("-");
    return `${day}.${m}.${y}.`;
  }
  const dateDisplay = comp.dateEnd && comp.dateEnd !== comp.date
    ? `${fmtDate(comp.date)} – ${fmtDate(comp.dateEnd)}`
    : fmtDate(comp.date);

  const levelStyle = LEVEL_STYLE[comp.level] ?? { background: "#f3f4f6", color: "#4b5563" };
  const levelLabel = getLevelLabel(comp.level, locale);

  // Završeno takmičenje: pregled po puška/pištolj umesto po danima (dan se računa u vremenskoj zoni takmičenja).
  const todayInComp = new Intl.DateTimeFormat("en-CA", { timeZone: comp.timezone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const endedOnServer = todayInComp > (comp.dateEnd ?? comp.date);

  const countryName = comp.country && ((locale === "en" ? comp.country.nameEn : comp.country.nameSr) ?? comp.country.name);

  // Localized competition name
  const compName = locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">

      {/* ── Breadcrumb ────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-xs text-[var(--muted)] mb-8">
        <ScopedLink href="/" className="hover:text-[var(--ink)] transition-colors">
          {tCommon("home")}
        </ScopedLink>
        <span className="text-[var(--subtle)]">/</span>
        <ScopedLink href="/takmicenja" className="hover:text-[var(--ink)] transition-colors">
          {t("list.title")}
        </ScopedLink>
        <span className="text-[var(--subtle)]">/</span>
        <span className="text-[var(--ink)] font-medium truncate max-w-[260px]">
          {compName}
        </span>
      </nav>

      {/* ── Competition header ────────────────────────────────────── */}
      <div className="mb-6 pb-5 border-b border-[var(--border)]">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-md text-[0.7rem] font-bold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide"
            style={levelStyle}
          >
            {levelLabel}
          </span>
        </div>

        {/* Title */}
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)] mb-3"
          style={{
            fontSize: "clamp(1.875rem, 5vw, 2.5rem)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {compName}
        </h1>

        {/* Identity row: date + place identify a recurring event, so they lead */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[var(--ink)]">
          <span className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none" className="shrink-0 text-[var(--muted)]" aria-hidden="true">
              <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1 6h12M4.5 1v2M9.5 1v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm sm:text-base font-semibold">
              {dateDisplay}
            </span>
          </span>
          {(comp.location || comp.country) && (
            <span className="flex items-center gap-2 text-sm sm:text-base font-semibold">
              <svg width="16" height="18" viewBox="0 0 12 14" fill="none" className="shrink-0 text-[var(--muted)]" aria-hidden="true">
                <path d="M6 1C3.79 1 2 2.79 2 5c0 3.25 4 8 4 8s4-4.75 4-8c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <circle cx="6" cy="5" r="1.3" fill="currentColor"/>
              </svg>
              {comp.country?.code2 && (
                <span
                  className={`fi fi-${comp.country.code2.toLowerCase()} shrink-0`}
                  style={{ width: "22px", height: "15px", borderRadius: "2px", display: "inline-block" }}
                />
              )}
              {countryName && <span>{countryName}</span>}
              {countryName && comp.location && <span className="text-[var(--subtle)]">·</span>}
              {comp.location && <span className={countryName ? "text-[var(--muted)]" : undefined}>{(locale === "en" ? (comp.locationEn ?? comp.location) : (comp.locationSr ?? comp.location))}</span>}
            </span>
          )}
        </div>
        {groups.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 text-sm text-[var(--muted)]">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="shrink-0 text-[var(--subtle)]" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="7" cy="7" r="0.7" fill="currentColor"/>
            </svg>
            <span>{[...new Set(groups.map((g) => g.code))].join(" · ")}</span>
          </div>
        )}
      </div>

      {/* ── Schedule ─────────────────────────────────────────────── */}
      <ScheduleSection slots={scheduleSlots} extras={scheduleExtras} locale={locale} timezone={comp.timezone ?? "UTC"} />

      {/* ── Results ───────────────────────────────────────────────── */}
      <div>
        <h2
          className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase tracking-tight text-[var(--ink)] mb-5"
          style={{ fontSize: "1.5rem", letterSpacing: "-0.02em" }}
        >
          {t("detail.results")}
        </h2>
        <CompetitionResultsClient formaByKey={formaByKey} groups={groups} mixedGroups={mixedGroups} competitionId={comp.id} locale={locale} competitionLevel={comp.level} timezone={comp.timezone ?? undefined} finalSlots={scheduleSlots.filter((slot) => slot.stage === "final")} qualSlots={scheduleSlots.filter((slot) => slot.stage === "qual")} dateFrom={comp.date} dateTo={comp.dateEnd} endedOnServer={endedOnServer} liveWindows={scheduleSlots} />
      </div>

      <RelatedNewsSection type="competition" refId={compId} locale={locale} />
    </div>
  );
}
