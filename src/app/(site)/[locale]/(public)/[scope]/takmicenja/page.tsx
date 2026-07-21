export const revalidate = 300;

import { db } from "@/lib/db";
import { competitions, results, disciplines, countries } from "@/lib/db/schema";
import { eq, desc, ilike, and, sql } from "drizzle-orm";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ScopedLink } from "../../components/ScopedLink";
import { Suspense } from "react";
import "./takmicenja.css";
import { CompetitionsFilterBar } from "./CompetitionsFilterBar";
import { ViewToggle } from "./ViewToggle";
import type { CompetitionLevel } from "@/lib/pdf-import/types";
import { LEVEL_STYLE, getLevelLabel } from "@/lib/competition-utils";
import { KalendarClient, type CalendarComp } from "../../kalendar/KalendarClient";
import { asc } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { buildAlternates } from "@/i18n/alternates";
import { buildCompetitionScopeFilter, type Scope } from "@/lib/scope";
import { WhenTabs } from "./WhenTabs";

export async function generateMetadata({ params }: { params: Promise<{ scope: Scope }> }): Promise<Metadata> {
  const { scope } = await params;
  const [t, locale] = await Promise.all([getTranslations("competition"), getLocale()]);
  return {
    title: t("list.title"),
    alternates: buildAlternates(locale, scope, "/takmicenja"),
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DISC_ORDER = ["ARM","ARW","APM","APW","R3PM","R3PW","R3JM","R3JW","SPW","RFPM","FPM"];

const LEVEL_PRIORITY: Record<string, number> = {
  olympic: 0, world: 1, continental: 2, international: 3, national: 4, regional: 5, club: 6,
};

const TAG_STYLE: Record<string, { background: string; color: string }> = {
  sss:  { background: "var(--tag-sss-bg)",  color: "var(--tag-sss-fg)" },
  issf: { background: "var(--tag-issf-bg)", color: "var(--tag-issf-fg)" },
  esc:  { background: "var(--tag-esc-bg)",  color: "var(--tag-esc-fg)" },
  "10m": { background: "#dbeafe", color: "#1d4ed8" },
  MK: { background: "#fef3c7", color: "#a16207" },
  "50m": { background: "#fff3cd", color: "#b45309" },
  "25m": { background: "#dcfce7", color: "#15803d" },
  "50/25m": { background: "#fef3c7", color: "#a16207" },
};

const FALLBACK_BADGE = { background: "var(--surface-2)", color: "var(--muted)" };

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS_SR = ["jan","feb","mar","apr","maj","jun","jul","avg","sep","okt","nov","dec"];
const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonths(locale: string) {
  return locale === "en" ? MONTHS_EN : MONTHS_SR;
}

function monthLabel(key: string, locale: string): string {
  const [yr, mo] = key.split("-");
  const months = getMonths(locale);
  return `${months[parseInt(mo) - 1]} ${yr}`;
}

function groupByMonth(comps: CompItem[]): Map<string, CompItem[]> {
  const map = new Map<string, CompItem[]>();
  for (const c of comps) {
    const key = c.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return map;
}

function formatDate(date: string, dateEnd?: string | null, locale?: string): string {
  const M = locale === "en" ? MONTHS_EN : MONTHS_SR;
  const d = new Date(date + "T00:00:00");
  const s = `${d.getDate()}. ${M[d.getMonth()]}`;
  if (!dateEnd || dateEnd === date) return s;
  const de = new Date(dateEnd + "T00:00:00");
  return de.getMonth() === d.getMonth()
    ? `${d.getDate()}\u2013${de.getDate()}. ${M[d.getMonth()]}`
    : `${s} \u2013 ${de.getDate()}. ${M[de.getMonth()]}`;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function formatCountdown(days: number, locale: string): string {
  if (locale === "en") {
    if (days <= 0) return "today";
    if (days === 1) return "tomorrow";
    if (days < 7) return `in ${days} days`;
    if (days < 14) return "in 1 week";
    if (days < 21) return "in 2 weeks";
    if (days < 30) return "in 3 weeks";
    if (days < 45) return "in 1 month";
    return `in ${Math.floor(days / 30)} months`;
  }
  if (days <= 0) return "danas";
  if (days === 1) return "sutra";
  if (days < 7) return `za ${days} dana`;
  if (days < 14) return "za nedelju";
  if (days < 21) return "za 2 ned.";
  if (days < 30) return "za 3 ned.";
  if (days < 45) return "za mesec";
  return `za ${Math.floor(days / 30)} mes.`;
}

function sortDiscs(codes: string[]): string[] {
  return [...codes].sort(
    (a, b) =>
      (DISC_ORDER.indexOf(a) >= 0 ? DISC_ORDER.indexOf(a) : 99) -
      (DISC_ORDER.indexOf(b) >= 0 ? DISC_ORDER.indexOf(b) : 99)
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompItem {
  id: number;
  name: string;
  nameSr: string | null;
  nameEn: string | null;
  date: string;
  dateEnd: string | null;
  location: string | null;
  level: string;
  tags: string[] | null;
  countryCode2: string | null;
  countryName: string | null;
  disciplineCodes: string[];
  resultCount: number;
}

// ── Row component ─────────────────────────────────────────────────────────────

function CompRow({
  comp,
  isLast,
  showCountdown,
  locale,
  levelLabel,
  animClass,
  animStyle,
}: {
  comp: CompItem;
  isLast: boolean;
  showCountdown: boolean;
  locale: string;
  levelLabel: string;
  animClass?: string;
  animStyle?: CSSProperties;
}) {
  const levelStyle = LEVEL_STYLE[comp.level] ?? FALLBACK_BADGE;
  const discCodes = sortDiscs(comp.disciplineCodes ?? []);
  const hasResults = comp.resultCount > 0;
  const tags = comp.tags ?? [];
  const countdown = showCountdown ? formatCountdown(daysUntil(comp.date), locale) : null;

  return (
    <ScopedLink
      href={`/takmicenja/${comp.id}`}
      className={`group flex items-center gap-3 sm:gap-4 px-4 py-3.5 transition-colors hover:bg-[var(--surface)] ${animClass ?? ""} ${
        !isLast ? "border-b border-[var(--border)]" : ""
      }`}
      style={animStyle}
    >
      {/* Date */}
      <div className="shrink-0 w-[92px] hidden sm:flex flex-col gap-0.5">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] tabular-nums leading-none">
          {formatDate(comp.date, comp.dateEnd, locale)}
        </span>
        {countdown && (
          <span className="text-[0.65rem] font-semibold text-[var(--brand-primary)] font-[family-name:var(--font-jetbrains-mono)] leading-none">
            {countdown}
          </span>
        )}
      </div>

      {/* Name + location */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[var(--ink)] group-hover:text-[var(--brand-primary)] transition-colors truncate leading-snug">
          {comp.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="sm:hidden font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] text-[var(--subtle)] tabular-nums">
            {formatDate(comp.date, comp.dateEnd, locale)}{countdown ? ` · ${countdown}` : ""}
          </span>
          {(comp.location || comp.countryCode2) && (
            <span className="hidden md:flex items-center gap-1 text-xs text-[var(--subtle)] min-w-0">
              {comp.countryCode2 && (
                <span
                  className={`fi fi-${comp.countryCode2.toLowerCase()} shrink-0`}
                  style={{ width: "13px", height: "9px", borderRadius: "1px", display: "inline-block" }}
                />
              )}
              <span className="truncate">
                {comp.location}
                {comp.countryName && comp.location ? ` · ${comp.countryName}` : ""}
                {comp.countryName && !comp.location ? comp.countryName : ""}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Disciplines */}
      <div className="hidden lg:flex items-center gap-1 shrink-0 flex-wrap justify-end" style={{ maxWidth: "130px" }}>
        {discCodes.slice(0, 4).map((code) => (
          <span
            key={code}
            className="font-[family-name:var(--font-barlow-condensed)] font-bold text-[0.58rem] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--muted)]"
          >
            {code}
          </span>
        ))}
        {discCodes.length > 4 && (
          <span className="text-[0.58rem] text-[var(--subtle)]">+{discCodes.length - 4}</span>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {tags.map((t) => {
            const ts = TAG_STYLE[t] ?? FALLBACK_BADGE;
            return (
              <span
                key={t}
                className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[0.6rem] uppercase px-1.5 py-0.5 rounded"
                style={ts}
              >
                {t}
              </span>
            );
          })}
        </div>
      )}

      {/* Level badge */}
      <span
        className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-bold uppercase tracking-wide font-[family-name:var(--font-barlow-condensed)] whitespace-nowrap"
        style={levelStyle}
      >
        {levelLabel}
      </span>

      {/* Result count */}
      {hasResults && (
        <span className="hidden xl:block shrink-0 text-[0.65rem] font-semibold text-green-600 dark:text-green-400 font-[family-name:var(--font-jetbrains-mono)] tabular-nums whitespace-nowrap">
          ✓ {comp.resultCount}
        </span>
      )}

      {/* Chevron */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        className="shrink-0 text-[var(--border-strong)] group-hover:text-[var(--muted)] transition-colors hidden sm:block"
        aria-hidden="true"
      >
        <path
          d="M4.5 2L8.5 6L4.5 10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </ScopedLink>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ scope: Scope }>;
  searchParams: Promise<{ year?: string; level?: string; q?: string; tag?: string; view?: string; archiveAll?: string; when?: string; location?: string }>;
}

export default async function TakmicenjaPage({ params, searchParams }: Props) {
  const { scope } = await params;
  const { year, level, q, tag, view, archiveAll, when, location } = await searchParams;
  const [locale, t] = await Promise.all([getLocale(), getTranslations("competition")]);

  const defaultYear  = new Date().getFullYear().toString();
  const activeYear   = year && /^\d{4}$/.test(year) ? year : defaultYear;
  const activeLevel  = level && level !== "all"     ? level : "all";
  const activeQ      = q?.trim() ?? "";
  const activeTag    = tag?.trim() ?? "";
  const activeView     = view === "cal" ? "cal" : "list";
  const activeWhen     = when === "past" ? "past" : "upcoming";
  const activeLocation = location?.trim() ?? "";

  // Date boundaries
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const todayStr = now.toISOString().split("T")[0];
  const recentCutoff = new Date(now);
  recentCutoff.setDate(recentCutoff.getDate() - 60);
  const recentCutoffStr = recentCutoff.toISOString().split("T")[0];

  const scopeFilter = buildCompetitionScopeFilter(scope);

  // SQL filters
  const sqlFilters = [
    scopeFilter,
    activeQ        ? ilike(competitions.name, `%${activeQ}%`)                          : undefined,
    activeYear  !== "all" ? ilike(competitions.date, `${activeYear}%`)               : undefined,
    activeLevel !== "all" ? eq(competitions.level, activeLevel as CompetitionLevel)  : undefined,
    activeTag      ? sql`${competitions.tags} @> ARRAY[${activeTag}]::varchar[]`     : undefined,
    activeLocation ? ilike(competitions.location, `%${activeLocation}%`)             : undefined,
  ].filter(Boolean) as Parameters<typeof and>;

  const [rows, yearRows, calRows] = await Promise.all([
    db
      .select({
        id:              competitions.id,
        name:            competitions.name,
        nameSr:          competitions.nameSr,
        nameEn:          competitions.nameEn,
        date:            competitions.date,
        dateEnd:         competitions.dateEnd,
        location:        competitions.location,
        level:           competitions.level,
        tags:            competitions.tags,
        countryCode2:    countries.code2,
        countryName:     countries.name,
        disciplineCodes: sql<string[]>`
          coalesce(
            array_agg(DISTINCT ${disciplines.code}::text) FILTER (WHERE ${disciplines.code} IS NOT NULL),
            '{}'::text[]
          )
        `,
        resultCount: sql<number>`COUNT(DISTINCT ${results.id})::int`,
      })
      .from(competitions)
      .leftJoin(countries, eq(competitions.countryId, countries.id))
      .leftJoin(results, eq(results.competitionId, competitions.id))
      .leftJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .where(sqlFilters.length ? and(...sqlFilters) : undefined)
      .groupBy(competitions.id, countries.name, countries.code2)
      .orderBy(desc(competitions.date)),
    db
      .selectDistinct({ year: sql<string>`LEFT(${competitions.date}, 4)` })
      .from(competitions)
      .where(scopeFilter)
      .orderBy(desc(sql`LEFT(${competitions.date}, 4)`)),
    db
      .select({
        id:      competitions.id,
        name:    competitions.name,
        nameSr:  competitions.nameSr,
        nameEn:  competitions.nameEn,
        date:    competitions.date,
        dateEnd: competitions.dateEnd,
        location: competitions.location,
        level:   competitions.level,
      })
      .from(competitions)
      .where(scopeFilter)
      .orderBy(asc(competitions.date)),
  ]);

  const availableYears = yearRows.map((r) => r.year).filter(Boolean) as string[];

  const filtered = rows as CompItem[];

  const calComps: CalendarComp[] = calRows.map((r) => ({
    id:       r.id,
    name:     locale === "en" ? (r.nameEn ?? r.name) : (r.nameSr ?? r.name),
    date:     r.date,
    dateEnd:  r.dateEnd ?? null,
    location: r.location ?? null,
    level:    r.level as CompetitionLevel,
  }));

  const translatedFiltered = filtered.map((comp) => ({
    ...comp,
    name: locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name),
  }));

  // Temporal split
  const live = translatedFiltered.filter(
    (c) => c.date <= todayStr && (c.dateEnd ?? c.date) >= todayStr
  );
  const upcoming = translatedFiltered
    .filter((c) => c.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  const recent = translatedFiltered
    .filter((c) => c.date < todayStr && c.date >= recentCutoffStr && !live.some((l) => l.id === c.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  const archive = translatedFiltered
    .filter((c) => c.date < recentCutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date));

  const isFiltered = activeQ || activeYear !== defaultYear || activeLevel !== "all" || activeTag || activeLocation;

  // Hero: live comps OR first-date upcoming group, sorted by level
  const heroItems: (CompItem & { isLive: boolean })[] = !isFiltered
    ? live.length > 0
      ? [...live]
          .sort((a, b) => (LEVEL_PRIORITY[a.level] ?? 9) - (LEVEL_PRIORITY[b.level] ?? 9))
          .map((c) => ({ ...c, isLive: true }))
      : upcoming.length > 0
        ? (() => {
            const firstDate = upcoming[0].date;
            return upcoming
              .filter((c) => c.date === firstDate)
              .sort((a, b) => (LEVEL_PRIORITY[a.level] ?? 9) - (LEVEL_PRIORITY[b.level] ?? 9))
              .map((c) => ({ ...c, isLive: false }));
          })()
        : []
    : [];

  // Upcoming grouped by month (hero items excluded)
  const heroIds = new Set(heroItems.map((c) => c.id));
  const upcomingRest = upcoming.filter((c) => !heroIds.has(c.id));
  const upcomingByMonth = groupByMonth(upcomingRest);
  const upcomingMonths = [...upcomingByMonth.keys()].sort();

  // Past (recent + archive) unified, grouped by month, most recent first
  const pastAll = [...recent, ...archive].sort((a, b) => b.date.localeCompare(a.date));
  const pastByMonth = groupByMonth(pastAll);
  const pastMonths = [...pastByMonth.keys()].sort((a, b) => b.localeCompare(a));
  const showAllArchive = archiveAll === "1";
  const visiblePastMonths = showAllArchive ? pastMonths : pastMonths.slice(0, 12);

  // URL builder preserving current filters
  function filterParams(extra: Record<string, string> = {}) {
    const p = new URLSearchParams();
    if (activeQ) p.set("q", activeQ);
    p.set("year", activeYear);
    if (activeLevel !== "all") p.set("level", activeLevel);
    if (activeTag) p.set("tag", activeTag);
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    return `/takmicenja?${p.toString()}`;
  }

  const whenHref = (w: string) => filterParams(w === "past" ? { when: "past" } : {});
  const pastMoreHref = filterParams({ when: "past", archiveAll: "1" });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1
            className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
            style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.025em", lineHeight: 1.05 }}
          >
            {t("list.title")}
          </h1>
        </div>
        <Suspense fallback={<div className="w-[148px] h-9 shrink-0 rounded-lg bg-[var(--surface-2)]" />}>
          <ViewToggle activeView={activeView} />
        </Suspense>
      </div>

      {/* Filter bar — list view only */}
      {activeView === "list" && (
        <Suspense fallback={<div className="h-20 mb-6" />}>
          <CompetitionsFilterBar
            availableYears={availableYears}
            currentYear={activeYear}
            currentLevel={activeLevel}
            currentQ={activeQ}
            currentTag={activeTag}
            totalCount={translatedFiltered.length}
            scope={scope}
          />
        </Suspense>
      )}

      {/* Calendar view */}
      {activeView === "cal" && (
        <KalendarClient competitions={calComps} />
      )}

      {/* When toggle — list view only */}
      {activeView === "list" && (
        <WhenTabs
          activeWhen={activeWhen}
          upcomingHref={whenHref("upcoming")}
          pastHref={whenHref("past")}
          upcomingCount={live.length + upcoming.length}
          pastCount={recent.length + archive.length}
          locale={locale}
        />
      )}

      {/* List view — empty state (no SQL results) */}
      {activeView === "list" && translatedFiltered.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-20 flex flex-col items-center gap-3">
          <p className="text-sm text-[var(--muted)] text-center max-w-none">
            {isFiltered ? t("list.noResults") : (locale === "en" ? "No competitions added yet." : "Još nema unetih takmičenja.")}
          </p>
          {isFiltered && (
            <ScopedLink
              href="/takmicenja"
              className="text-xs text-[var(--brand-primary)] hover:underline"
            >
              {locale === "en" ? "Show all →" : "Prikaži sva →"}
            </ScopedLink>
          )}
        </div>
      )}

      {/* List view — filtered results */}
      {activeView === "list" && translatedFiltered.length > 0 && (
        <div className="space-y-10">

          {/* ── UPCOMING TAB ──────────────────────────────────────────── */}
          {activeWhen === "upcoming" && live.length === 0 && upcoming.length === 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-20 flex flex-col items-center gap-3">
              <p className="text-sm text-[var(--muted)] text-center max-w-none">
                {locale === "en" ? "No upcoming competitions for the selected filters." : "Nema nadolazećih takmičenja za izabrane filtere."}
              </p>
              <ScopedLink href={whenHref("past")} className="text-xs text-[var(--brand-primary)] hover:underline">
                {locale === "en" ? "View past →" : "Pogledaj prošla →"}
              </ScopedLink>
            </div>
          )}

          {/* ── HERO (live or first upcoming group) + rest ───────────── */}
          {activeWhen === "upcoming" && (heroItems.length > 0 || upcomingMonths.length > 0) && (
            <section aria-label="Nadolazeća takmičenja">
              {heroItems.length > 0 && <div className="space-y-2 mb-2">
                {heroItems.map((hero) => (
                  <ScopedLink
                    key={hero.id}
                    href={`/takmicenja/${hero.id}`}
                    className="comp-hero group block rounded-xl border overflow-hidden hover:shadow-sm transition-all"
                    style={hero.isLive
                      ? { borderColor: "var(--live-border)", background: "var(--live-bg)" }
                      : { borderColor: "var(--border)", background: "var(--surface)" }
                    }
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          {/* Badges row */}
                          <div className="flex items-center gap-2 flex-wrap mb-2.5">
                            {hero.isLive && (
                              <span
                                className="inline-flex items-center gap-1.5 shrink-0 font-extrabold select-none rounded px-1.5"
                                style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--brand-primary)", background: "white", height: 20, border: "1px solid var(--border)" }}
                              >
                                <span
                                  className="rounded-full shrink-0"
                                  style={{ width: 5, height: 5, background: "var(--brand-primary)", display: "inline-block", animation: "ticker-pulse 1.4s ease-in-out infinite" }}
                                />
                                {locale === "en" ? "Live" : "U toku"}
                              </span>
                            )}
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-bold uppercase tracking-wide font-[family-name:var(--font-barlow-condensed)]"
                              style={LEVEL_STYLE[hero.level] ?? FALLBACK_BADGE}
                            >
                              {getLevelLabel(hero.level, locale)}
                            </span>
                            {!hero.isLive && (
                              <span className="text-xs font-semibold text-[var(--brand-primary)] font-[family-name:var(--font-jetbrains-mono)]">
                                {formatCountdown(daysUntil(hero.date), locale)}
                              </span>
                            )}
                            {(hero.tags ?? []).map((tag) => {
                              const ts = TAG_STYLE[tag] ?? FALLBACK_BADGE;
                              return (
                                <span
                                  key={tag}
                                  className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[0.6rem] uppercase px-1.5 py-0.5 rounded"
                                  style={ts}
                                >
                                  {tag}
                                </span>
                              );
                            })}
                          </div>

                          {/* Name */}
                          <h2
                            className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)] group-hover:text-[var(--brand-primary)] transition-colors leading-tight mb-2"
                            style={{ fontSize: "clamp(1.15rem, 2.5vw, 1.65rem)", letterSpacing: "-0.02em" }}
                          >
                            {hero.name}
                          </h2>

                          {/* Meta */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                            <span className="font-[family-name:var(--font-jetbrains-mono)] tabular-nums">
                              {formatDate(hero.date, hero.dateEnd, locale)}
                            </span>
                            {(hero.location || hero.countryCode2) && (
                              <span className="flex items-center gap-1.5">
                                {hero.countryCode2 && (
                                  <span
                                    className={`fi fi-${hero.countryCode2.toLowerCase()} shrink-0`}
                                    style={{ width: "14px", height: "10px", borderRadius: "1px", display: "inline-block" }}
                                  />
                                )}
                                <span>
                                  {hero.location}
                                  {hero.countryName && hero.location ? ` · ${hero.countryName}` : ""}
                                  {hero.countryName && !hero.location ? hero.countryName : ""}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Discipline badges */}
                        {sortDiscs(hero.disciplineCodes ?? []).length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap shrink-0 justify-end pt-0.5">
                            {sortDiscs(hero.disciplineCodes ?? []).map((code) => (
                              <span
                                key={code}
                                className="font-[family-name:var(--font-barlow-condensed)] font-bold text-[0.65rem] uppercase tracking-wide px-2 py-1 rounded bg-[var(--surface-2)] text-[var(--muted)]"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </ScopedLink>
                ))}
              </div>}

              {/* Rest of upcoming — grouped by month */}
              {upcomingMonths.length > 0 && (
                <div className="space-y-5 mt-2">
                  {upcomingMonths.map((mk, monthIdx) => {
                    const comps = upcomingByMonth.get(mk)!;
                    return (
                      <div key={mk} className="comp-month" style={{ '--month-idx': monthIdx } as CSSProperties}>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-semibold text-[var(--muted)] capitalize">{monthLabel(mk, locale)}</span>
                          <div className="flex-1 h-px bg-[var(--border)]" />
                          <span className="text-[0.65rem] text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)]">{comps.length}</span>
                        </div>
                        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                          {comps.map((c, i) => (
                            <CompRow key={c.id} comp={c} isLast={i === comps.length - 1} showCountdown locale={locale} levelLabel={getLevelLabel(c.level, locale)} animClass="comp-row" animStyle={{ '--month-idx': monthIdx, '--row-idx': i } as CSSProperties} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ── PAST TAB — all past unified by month ─────────────────── */}
          {activeWhen === "past" && pastAll.length === 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-20 flex flex-col items-center gap-3">
              <p className="text-sm text-[var(--muted)] text-center max-w-none">
                {locale === "en" ? "No past competitions for the selected filters." : "Nema prošlih takmičenja za izabrane filtere."}
              </p>
            </div>
          )}

          {activeWhen === "past" && pastAll.length > 0 && (
            <section aria-label="Prošla takmičenja">
              <div className="space-y-5">
                {visiblePastMonths.map((mk, monthIdx) => {
                  const comps = pastByMonth.get(mk)!;
                  return (
                    <div key={mk} className="comp-month" style={{ '--month-idx': monthIdx } as CSSProperties}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-semibold text-[var(--muted)] capitalize">{monthLabel(mk, locale)}</span>
                        <div className="flex-1 h-px bg-[var(--border)]" />
                        <span className="text-[0.65rem] text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)]">{comps.length}</span>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                        {comps.map((c, i) => (
                          <CompRow key={c.id} comp={c} isLast={i === comps.length - 1} showCountdown={false} locale={locale} levelLabel={getLevelLabel(c.level, locale)} animClass="comp-row" animStyle={{ '--month-idx': monthIdx, '--row-idx': i } as CSSProperties} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!showAllArchive && pastMonths.length > 12 && (
                  <ScopedLink
                    href={pastMoreHref}
                    className="flex items-center justify-center gap-1.5 py-3 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors hover:underline"
                  >
                    {locale === "en"
                      ? `Show ${pastMonths.length - 12} older months →`
                      : `Prikaži ${pastMonths.length - 12} starijih meseci →`}
                  </ScopedLink>
                )}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
}
