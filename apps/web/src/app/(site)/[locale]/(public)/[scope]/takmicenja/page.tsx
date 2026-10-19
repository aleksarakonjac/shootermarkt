export const revalidate = 300;

import { db } from "@shootermarkt/db";
import { competitions, results, disciplines, countries } from "@shootermarkt/db/schema";
import { eq, desc, ilike, inArray, and, sql } from "drizzle-orm";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ScopedLink } from "../../components/ScopedLink";
import { Suspense } from "react";
import "./takmicenja.css";
import { CompetitionsFilterBar } from "./CompetitionsFilterBar";
import type { CompetitionLevel } from "@shootermarkt/db/pdf-import-types";
import { LEVEL_STYLE, getLevelLabel } from "@/lib/competition-utils";
import { CompetitionCalendar, type CalendarComp } from "./CompetitionCalendar";
import { levelsForGroups, parseDisciplineParam, parseLevelParam, ISSF_LEVEL_GROUP_KEYS } from "@/lib/competition-filters";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatShortDateRange as formatDate } from "@/lib/date-utils";
import { buildAlternates } from "@/i18n/alternates";
import { buildCompetitionScopeFilter, type Scope } from "@/lib/scope";

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

// Grupa discipline na kartici: kratka oznaka, puno ime u title (filter koristi puna imena).
const DISCIPLINE_BADGE: Record<string, { short: string; sr: string; en: string; style: { background: string; color: string } }> = {
  air:       { short: "10m", sr: "Vazdušno",       en: "Air",        style: { background: "#dbeafe", color: "#1d4ed8" } },
  smallbore: { short: "MK",  sr: "Malokalibarsko", en: "Small-bore", style: { background: "#fef3c7", color: "#a16207" } },
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

function groupByMonth<T extends { date: string }>(comps: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const c of comps) {
    const key = c.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return map;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function formatCountdown(days: number, locale: string): string {
  if (locale === "en") {
    if (days <= 0) return "live";
    if (days === 1) return "tomorrow";
    if (days < 7) return `in ${days} days`;
    if (days < 14) return "in 1 week";
    if (days < 21) return "in 2 weeks";
    if (days < 30) return "in 3 weeks";
    if (days < 45) return "in 1 month";
    return `in ${Math.floor(days / 30)} months`;
  }
  if (days <= 0) return "u toku";
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
  locationSr: string | null;
  locationEn: string | null;
  level: string;
  disciplineGroups: string[] | null;
  countryCode2: string | null;
  countryName: string | null;
  disciplineCodes: string[];
  resultCount: number;
}

type RowStatus = "past" | "live" | "next" | "upcoming";
type RowItem = CompItem & { status: RowStatus };

// Oznaka u redu: takmičenje u toku (puls) ili sledeće koje počinje.
function StatusPill({ status, locale }: { status: RowStatus; locale: string }) {
  if (status === "live") {
    return (
      <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded border border-[var(--live-border)] bg-[var(--bg)] px-1.5 py-px font-[family-name:var(--font-barlow-condensed)] text-[0.7rem] font-extrabold uppercase leading-4 tracking-[0.06em] text-[var(--brand-primary)]">
        <span className="h-[5px] w-[5px] rounded-full bg-[var(--brand-primary)] motion-safe:animate-[ticker-pulse_1.4s_ease-in-out_infinite]" aria-hidden="true" />
        {locale === "en" ? "Live" : "U toku"}
      </span>
    );
  }
  if (status === "next") {
    return (
      <span className="inline-flex w-fit shrink-0 items-center rounded bg-[var(--brand-primary)] px-1.5 py-px font-[family-name:var(--font-barlow-condensed)] text-[0.7rem] font-extrabold uppercase leading-4 tracking-[0.06em] text-white">
        {locale === "en" ? "Next" : "Sledeće"}
      </span>
    );
  }
  return null;
}

// ── Row component ─────────────────────────────────────────────────────────────

function CompRow({
  comp,
  isLast,
  status,
  locale,
  levelLabel,
  animClass,
  animStyle,
}: {
  comp: CompItem;
  isLast: boolean;
  status: RowStatus;
  locale: string;
  levelLabel: string;
  animClass?: string;
  animStyle?: CSSProperties;
}) {
  const past = status === "past";
  const levelStyle = LEVEL_STYLE[comp.level] ?? FALLBACK_BADGE;
  const discCodes = sortDiscs(comp.disciplineCodes ?? []);
  const hasResults = comp.resultCount > 0;
  const groups = comp.disciplineGroups ?? [];
  const countdown = status === "next" || status === "upcoming" ? formatCountdown(daysUntil(comp.date), locale) : null;
  const resultNote = past ? (hasResults ? `${comp.resultCount} ${locale === "en" ? "results" : "rez."}` : (locale === "en" ? "no results" : "bez rez.")) : null;

  return (
    <ScopedLink
      href={`/takmicenja/${comp.id}`}
      id={`comp-${comp.id}`}
      data-comp-start={comp.date}
      data-comp-end={comp.dateEnd ?? comp.date}
      className={`group flex items-center gap-3 sm:gap-4 px-4 py-3.5 transition-colors ${status === "live" ? "bg-[var(--live-bg)] hover:brightness-[0.98]" : "hover:bg-[var(--surface)]"} ${animClass ?? ""} ${
        !isLast ? "border-b border-[var(--border)]" : ""
      }`}
      style={animStyle}
    >
      {/* Date */}
      <div className="shrink-0 w-[92px] hidden sm:flex flex-col gap-0.5">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] tabular-nums leading-none">
          {formatDate(comp.date, comp.dateEnd, locale)}
        </span>
        <StatusPill status={status} locale={locale} />
        {countdown && (
          <span className="text-[0.65rem] font-semibold text-[var(--brand-primary)] font-[family-name:var(--font-jetbrains-mono)] leading-none">
            {countdown}
          </span>
        )}
        {resultNote && (
          <span className={`text-[0.65rem] font-semibold font-[family-name:var(--font-jetbrains-mono)] tabular-nums leading-none ${hasResults ? "text-green-700 dark:text-green-400" : "text-[var(--subtle)]"}`}>
            {resultNote}
          </span>
        )}
      </div>

      {/* Name + location */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[var(--ink)] group-hover:text-[var(--brand-primary)] transition-colors truncate leading-snug">
          {comp.name}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <span className="sm:hidden flex items-center gap-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] text-[var(--subtle)] tabular-nums">
            <StatusPill status={status} locale={locale} />
            {formatDate(comp.date, comp.dateEnd, locale)}{countdown ? ` · ${countdown}` : ""}{resultNote ? ` · ${resultNote}` : ""}
          </span>
          {(comp.location || comp.countryCode2) && (
            <span className="flex w-full sm:w-auto items-center gap-1 text-xs text-[var(--subtle)] min-w-0">
              {comp.countryCode2 && (
                <span
                  className={`fi fi-${comp.countryCode2.toLowerCase()} shrink-0`}
                  style={{ width: "13px", height: "9px", borderRadius: "1px", display: "inline-block" }}
                />
              )}
              <span className="truncate">
                {(() => { const loc = locale === "en" ? (comp.locationEn ?? comp.location) : (comp.locationSr ?? comp.location); return loc; })()}
                {comp.countryName && comp.location ? ` · ${comp.countryName}` : ""}
                {comp.countryName && !comp.location ? comp.countryName : ""}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Disciplines */}
      <div className="hidden xl:flex items-center gap-1 shrink-0 flex-wrap justify-end" style={{ maxWidth: "130px" }}>
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

      {/* Discipline group */}
      {groups.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {groups.map((g) => {
            const badge = DISCIPLINE_BADGE[g];
            if (!badge) return null;
            return (
              <span
                key={g}
                title={locale === "en" ? badge.en : badge.sr}
                className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[0.6rem] uppercase px-1.5 py-0.5 rounded"
                style={badge.style}
              >
                {badge.short}
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

// ── Month blocks ──────────────────────────────────────────────────────────────

function MonthGroup({ mk, comps, idx, locale, fullName }: { mk: string; comps: RowItem[]; idx: number; locale: string; fullName: string }) {
  return (
    <div className="comp-month" style={{ '--month-idx': idx } as CSSProperties}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-semibold text-[var(--muted)] capitalize">
          <span className="sm:hidden">{fullName} {mk.slice(0, 4)}</span>
          <span className="hidden sm:inline">{monthLabel(mk, locale)}</span>
        </span>
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-[0.65rem] text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)]">{comps.length}</span>
      </div>
      {/* U toku: zaseban blok na vrhu meseca, odvojen od hronološkog niza ispod */}
      {[comps.filter((c) => c.status === "live"), comps.filter((c) => c.status !== "live")]
        .filter((block) => block.length > 0)
        .map((block, b) => (
          <div
            key={b}
            className={`rounded-xl border overflow-hidden ${block[0].status === "live" ? "mb-3 border-[var(--live-border)]" : "border-[var(--border)]"}`}
          >
            {block.map((c, i) => (
              <CompRow key={c.id} comp={c} isLast={i === block.length - 1} status={c.status} locale={locale} levelLabel={getLevelLabel(c.level, locale)} animClass="comp-row" animStyle={{ '--month-idx': idx, '--row-idx': comps.indexOf(c) } as CSSProperties} />
            ))}
          </div>
        ))}
    </div>
  );
}

// Sažet prošli mesec: jedan red (mesec, broj, nivoi, pokrivenost rezultatima); <details> ga razvija na licu mesta.
function FoldedMonth({ mk, comps, locale, fullName }: { mk: string; comps: CompItem[]; locale: string; fullName: string }) {
  const levels = [...new Set(comps.map((c) => c.level))].sort((a, b) => (LEVEL_PRIORITY[a] ?? 9) - (LEVEL_PRIORITY[b] ?? 9));
  const [yr, mo] = mk.split("-");
  return (
    <details className="season-fold group/fold">
      <summary className="season-fold-summary flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors sm:min-h-0 sm:py-2.5 hover:bg-[var(--surface)] [&::-webkit-details-marker]:hidden">
        <span className="season-fold-month shrink-0 text-[0.95rem] font-semibold capitalize text-[var(--ink)] sm:w-[4.5rem] sm:text-sm">
          <span className="sm:hidden">{fullName}</span>
          <span className="hidden sm:inline">{getMonths(locale)[parseInt(mo) - 1]}</span> <span className="season-fold-year font-normal text-[var(--subtle)]">{yr}</span>
        </span>
        <span className="season-fold-count ml-auto font-[family-name:var(--font-jetbrains-mono)] text-xs sm:ml-0 tabular-nums text-[var(--muted)]">
          {comps.length}<span className="season-fold-extra"> {locale === "en" ? (comps.length === 1 ? "event" : "events") : "takm."}</span>
        </span>
        <span className="season-fold-extra hidden sm:flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {levels.slice(0, 3).map((l) => (
            <span key={l} className="shrink-0 rounded px-1.5 py-px font-[family-name:var(--font-barlow-condensed)] text-[0.6rem] font-bold uppercase tracking-wide" style={LEVEL_STYLE[l] ?? FALLBACK_BADGE}>
              {getLevelLabel(l, locale)}
            </span>
          ))}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" className="season-fold-chevron shrink-0 text-[var(--muted)] transition-transform group-open/fold:rotate-90" aria-hidden="true">
          <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </summary>
      <div className="season-fold-body border-t border-[var(--border)]">
        {comps.map((c, i) => (
          <CompRow key={c.id} comp={c} isLast={i === comps.length - 1} status="past" locale={locale} levelLabel={getLevelLabel(c.level, locale)} animStyle={{ '--row-idx': i } as CSSProperties} />
        ))}
      </div>
    </details>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ scope: Scope }>;
  searchParams: Promise<{ year?: string; level?: string; disc?: string; q?: string; tag?: string; view?: string; focus?: string; location?: string }>;
}

export default async function TakmicenjaPage({ params, searchParams }: Props) {
  const { scope } = await params;
  const { year, level, disc, q, tag, view, location } = await searchParams;

  // Stari link ?view=cal: kalendar je sada deo istog ekrana.
  if (view) {
    const rest = new URLSearchParams();
    for (const [k, v] of Object.entries({ year, level, disc, q, tag, location })) if (v) rest.set(k, v);
    redirect(`/${scope}/takmicenja${rest.size ? `?${rest.toString()}` : ""}`);
  }
  const [locale, t, tCal] = await Promise.all([getLocale(), getTranslations("competition"), getTranslations("calendar")]);

  const defaultYear  = new Date().getFullYear().toString();
  const activeYear   = year === "all" ? "all" : year && /^\d{4}$/.test(year) ? year : defaultYear;
  const activeLevels = parseLevelParam(level).filter((key) => scope !== "issf" || ISSF_LEVEL_GROUP_KEYS.includes(key));
  const activeDisc   = parseDisciplineParam(disc, tag);
  const activeQ      = q?.trim() ?? "";
  const activeLocation = location?.trim() ?? "";

  // Date boundaries
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // Prošli i tekući mesec ostaju razvijeni; stariji se sažimaju.
  const recentMonthKey = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 7);

  const scopeFilter = buildCompetitionScopeFilter(scope);

  // SQL filters
  const sqlFilters = [
    scopeFilter,
    activeQ        ? ilike(competitions.name, `%${activeQ}%`)                          : undefined,
    activeYear  !== "all" ? ilike(competitions.date, `${activeYear}%`)               : undefined,
    activeLevels.length ? inArray(competitions.level, levelsForGroups(activeLevels) as CompetitionLevel[]) : undefined,
    activeDisc.length   ? sql`${competitions.disciplineGroups} && ARRAY[${sql.join(activeDisc.map((d) => sql`${d}`), sql`, `)}]::varchar[]` : undefined,
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
        locationSr:      competitions.locationSr,
        locationEn:      competitions.locationEn,
        level:           competitions.level,
        disciplineGroups: competitions.disciplineGroups,
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
        locationSr: competitions.locationSr,
        locationEn: competitions.locationEn,
        level:   competitions.level,
        disciplineGroups: competitions.disciplineGroups,
        countryName: countries.name,
        countryCode2: countries.code2,
      })
      .from(competitions)
      .leftJoin(countries, eq(competitions.countryId, countries.id))
      .where(scopeFilter)
      .orderBy(competitions.date),
  ]);

  const availableYears = yearRows.map((r) => r.year).filter(Boolean) as string[];

  const filtered = rows as CompItem[];

  // Tačke u mreži prate filtere (pretraga, nivo, tag, lokacija) ali ne i godinu, da se vide svi meseci.
  const qLower = activeQ.toLowerCase();
  const locLower = activeLocation.toLowerCase();
  const calComps: CalendarComp[] = calRows
    .filter((r) =>
      (!qLower || r.name.toLowerCase().includes(qLower)) &&
      (!activeLevels.length || levelsForGroups(activeLevels).includes(r.level)) &&
      (!activeDisc.length || (r.disciplineGroups ?? []).some((g) => (activeDisc as string[]).includes(g))) &&
      (!locLower || (r.location ?? "").toLowerCase().includes(locLower)))
    .map((r) => ({
      id: r.id,
      name: (locale === "en" ? r.nameEn : r.nameSr) ?? r.name,
      location: (locale === "en" ? r.locationEn : r.locationSr) ?? r.location,
      date: r.date,
      dateEnd: r.dateEnd ?? null,
      level: r.level,
      countryName: r.countryName,
      countryCode2: r.countryCode2,
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
  const past = translatedFiltered
    .filter((c) => (c.dateEnd ?? c.date) < todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const isFiltered = activeQ || activeYear !== defaultYear || activeLevels.length > 0 || activeDisc.length > 0 || activeLocation;

  // U toku: istaknuto na vrhu liste (i ponovo kao red u svom mesecu).
  const liveItems = [...live]
    .sort((a, b) => (LEVEL_PRIORITY[a.level] ?? 9) - (LEVEL_PRIORITY[b.level] ?? 9))
    .map((c) => ({ ...c, isLive: true }));

  // Jedna hronološka lista bez preseka: status reda nosi „u toku" / „sledeće".
  const nextDate = upcoming[0]?.date;
  // U svakom mesecu: takmičenja u toku na vrhu, ostalo po datumu.
  const rowsAll: RowItem[] = translatedFiltered
    .map((c): RowItem => ({
      ...c,
      status: (c.dateEnd ?? c.date) < todayStr ? "past" : c.date <= todayStr ? "live" : c.date === nextDate ? "next" : "upcoming",
    }))
    .sort((a, b) =>
      a.date.slice(0, 7).localeCompare(b.date.slice(0, 7)) ||
      Number(b.status === "live") - Number(a.status === "live") ||
      a.date.localeCompare(b.date));
  const byMonth = groupByMonth(rowsAll);
  const months = [...byMonth.keys()].sort();
  // Tekuća sezona: stariji meseci (sve održano) se sažimaju; prošli i tekući mesec ostaju razvijeni.
  const isCurrentSeason = activeYear === defaultYear || activeYear === "all";
  const foldedMonths = isCurrentSeason
    ? months.filter((mk) => mk < recentMonthKey && byMonth.get(mk)!.every((c) => c.status === "past"))
    : [];
  const openMonths = months.filter((mk) => !foldedMonths.includes(mk));

  // URL builder preserving current filters
  function filterParams(extra: Record<string, string> = {}) {
    const p = new URLSearchParams();
    if (activeQ) p.set("q", activeQ);
    p.set("year", activeYear);
    if (activeLevels.length) p.set("level", activeLevels.join(","));
    if (activeDisc.length) p.set("disc", activeDisc.join(","));
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    return `/takmicenja?${p.toString()}`;
  }

  // Susedne godine koje imaju takmičenja.
  const yearNum = Number(activeYear);
  const prevYear = activeYear !== "all" && availableYears.includes(String(yearNum - 1)) ? String(yearNum - 1) : null;
  const nextYear = activeYear !== "all" && availableYears.includes(String(yearNum + 1)) ? String(yearNum + 1) : null;
  const yearHref = (y: string) => filterParams({ year: y });

  // Istaknuta kartica: takmičenje u toku ili prvo sledeće.
  const heroCard = (hero: CompItem & { isLive: boolean }) => (
    <ScopedLink
      key={hero.id}
      href={`/takmicenja/${hero.id}`}
      id={`comp-${hero.id}`}
      data-comp-start={hero.date}
      data-comp-end={hero.dateEnd ?? hero.date}
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
              {(hero.disciplineGroups ?? []).map((g) => {
                const badge = DISCIPLINE_BADGE[g];
                if (!badge) return null;
                return (
                  <span
                    key={g}
                    title={locale === "en" ? badge.en : badge.sr}
                    className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[0.6rem] uppercase px-1.5 py-0.5 rounded"
                    style={badge.style}
                  >
                    {badge.short}
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
                    {locale === "en" ? (hero.locationEn ?? hero.location) : (hero.locationSr ?? hero.location)}
                    {hero.countryName && hero.location ? ` · ${hero.countryName}` : ""}
                    {hero.countryName && !hero.location ? hero.countryName : ""}
                  </span>
                </span>
              )}
            </div>
            {sortDiscs(hero.disciplineCodes ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
      </div>
    </ScopedLink>
  );

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
      </div>

      {/* Filter bar */}
      <Suspense fallback={<div className="h-20 mb-6" />}>
        <CompetitionsFilterBar
          availableYears={availableYears}
          currentYear={activeYear}
          currentLevels={activeLevels}
          currentDisc={activeDisc}
          totalCount={translatedFiltered.length}
          scope={scope}
        />
      </Suspense>

      {/* Hybrid: kalendar je filter po danu za listu */}
      <div className="lg:grid lg:grid-cols-[19.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="mb-6 lg:mb-0">
        <Suspense fallback={<div className="h-11 rounded-xl bg-[var(--surface-2)] lg:h-80" />}>
          <CompetitionCalendar competitions={calComps} />
        </Suspense>
      </div>
      <div className="min-w-0">

      {/* Sezona: održano / predstoji umesto tabova */}
      {translatedFiltered.length > 0 && (
        <div className="mb-6 flex items-baseline gap-5 border-b border-[var(--border)] pb-2.5 text-sm text-[var(--muted)]">
          <span><b className="font-[family-name:var(--font-jetbrains-mono)] font-semibold tabular-nums text-[var(--ink)]">{past.length}</b> {locale === "en" ? "held" : "održano"}</span>
          <span><b className="font-[family-name:var(--font-jetbrains-mono)] font-semibold tabular-nums text-[var(--ink)]">{live.length + upcoming.length}</b> {locale === "en" ? "upcoming" : "predstoji"}</span>
        </div>
      )}

      {/* Empty state (no SQL results) */}
      {translatedFiltered.length === 0 && (
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

      {/* Filtered results */}
      {translatedFiltered.length > 0 && (
        <div className="space-y-10">

          {/* ── U TOKU: zasebno na vrhu ──────────────────────────────── */}
          {liveItems.length > 0 && (
            <section aria-label={locale === "en" ? "Live now" : "U toku"} className="space-y-2">
              {liveItems.map(heroCard)}
            </section>
          )}

          {/* ── Sezona: sažeti stari meseci, pa sve ostalo hronološki ─── */}
          <section aria-label={locale === "en" ? "Competitions" : "Takmičenja"} className="space-y-5">
            {foldedMonths.length > 0 && (
              <div className="season-ledger">
                {foldedMonths.map((mk) => (
                  <FoldedMonth key={mk} mk={mk} comps={byMonth.get(mk)!} locale={locale} fullName={tCal(`months.${parseInt(mk.slice(5)) - 1}`)} />
                ))}
              </div>
            )}
            {openMonths.map((mk, i) => (
              <MonthGroup key={mk} mk={mk} comps={byMonth.get(mk)!} idx={i} locale={locale} fullName={tCal(`months.${parseInt(mk.slice(5)) - 1}`)} />
            ))}
          </section>

        </div>
      )}

      {/* Prelistavanje po godinama: prethodna / sledeća godina koja ima takmičenja */}
      {(prevYear || nextYear) && (
        <nav
          aria-label={locale === "en" ? "Browse by year" : "Prelistavanje po godinama"}
          className="mt-10 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4"
        >
          {prevYear ? (
            <ScopedLink
              href={yearHref(prevYear)}
              className="group inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--muted)] no-underline hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
              <span className="font-[family-name:var(--font-jetbrains-mono)] tabular-nums">{prevYear}</span>
            </ScopedLink>
          ) : <span />}
          {nextYear ? (
            <ScopedLink
              href={yearHref(nextYear)}
              className="group inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--muted)] no-underline hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
            >
              <span className="font-[family-name:var(--font-jetbrains-mono)] tabular-nums">{nextYear}</span>
              <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            </ScopedLink>
          ) : <span />}
        </nav>
      )}
      </div>
      </div>
    </div>
  );
}
