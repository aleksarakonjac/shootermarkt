"use client";

import { countryKeywords } from "@/lib/country-search";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ScopedLink } from "../../components/ScopedLink";
import { NOC_LIST, displayNoc } from "@shootermarkt/db/noc-list";
import {
  trendLabel,
  trendColor,
  type Trend,
  type CompetitionLevel,
} from "@/lib/forma";
import {
  computeAvgOfTopN,
  computeRecentAvg,
  computeMean,
  computeSeasonAvg,
  filterByPeriod,
  currentSeasonStartYear,
  seasonWindow,
  seasonLabel as formatSeasonLabel,
  type SeasonType,
  type PeriodType,
  type MetricEntry,
} from "@/lib/ranking-metrics";
import type { AgeCategory } from "@shootermarkt/db/pdf-import-types";
import { categoryLabel } from "@/lib/match-name";
import { SearchDropdown } from "@/components/ui/SearchDropdown";
import { FormaScoreMark } from "@/components/shooter/FormaScoreMark";

// ── Types ─────────────────────────────────────────────────────────────────────

type DiscCode = "ARM" | "ARW" | "APM" | "APW" | "R3PM" | "R3PW" | "SPW" | "RFPM";
type SortKey = "forma" | "peak" | "best3" | "avg" | "recent3" | "delta" | "count";
type ViewKey = "forma" | "peak" | "best3" | "seasonavg" | "recent3" | "improved";

export type RangiranjeShooter = {
  shooterId: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  clubName: string | null;
  category: AgeCategory;
  bestInners: number | null;
  matches: Array<{
    competitionId: number;
    competitionName: string;
    date: string;
    level: CompetitionLevel;
    qualTotal: number;
    qualRank: number | null;
  }>;
  // From forma cache
  forma: number | null;
  formaTrend: Trend;
  formaSampleSize: number;
  peakCareer: number | null;
  best3Career: number | null;
  recent3Career: number | null;
  seasonAvgCache: number | null; // vazdusna current season, from cache
  careerCount: number;
};

export type RangiranjeLabels = {
  title: string;
  subtitle: string;
  noData: string;
  shooter: string;
  country: string;
  club: string;
  peak: string;
  inSeason: string;
  inners: string;
  appearances: string;
  improvedCol: string;
  periodCareer: string;
  seasonAir: string;
  seasonCalendar: string;
  viewForma: string;
  viewPeak: string;
  viewBest3: string;
  viewSeasonAvg: string;
  viewRecent3: string;
  viewImproved: string;
  activeTabLabel: string;
  categoryLabels: Record<string, string>;
  all: string;
};

type Props = {
  activeCode: DiscCode;
  isAP: boolean;
  shooters: RangiranjeShooter[];
  categoriesPresent: AgeCategory[];
  labels: RangiranjeLabels;
  locale: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const VIEWS: { key: ViewKey; labelKey: keyof RangiranjeLabels }[] = [
  { key: "forma",    labelKey: "viewForma" },
  { key: "peak",     labelKey: "viewPeak" },
  { key: "best3",    labelKey: "viewBest3" },
  { key: "seasonavg", labelKey: "viewSeasonAvg" },
  { key: "recent3",  labelKey: "viewRecent3" },
  { key: "improved", labelKey: "viewImproved" },
];

const PERIOD_VIEWS: ViewKey[] = ["peak", "best3", "seasonavg", "recent3"];
const IMPROVED_VIEWS: ViewKey[] = ["improved"];
// Pogledi bez "Karijera" perioda (smisleno samo za konkretnu godinu).
const NO_CAREER_VIEWS: ViewKey[] = ["improved", "recent3"];

const TH = "px-4 py-3 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] select-none";

// ── Helpers ───────────────────────────────────────────────────────────────────

function nocAlpha2(noc: string | null): string | null {
  if (!noc) return null;
  return NOC_LIST.find((n) => n.noc === noc)?.alpha2 ?? null;
}

function FlagChip({ noc: rawNoc, inline = false }: { noc: string | null; inline?: boolean }) {
  if (!rawNoc) return <span className="text-[var(--subtle)]">—</span>;
  const noc = displayNoc(rawNoc);
  const a2 = nocAlpha2(noc);
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)] ${
        inline ? "" : "px-1.5 py-0.5 rounded bg-[var(--surface-2)]"
      }`}
    >
      {a2 && (
        <span
          className={`fi fi-${a2.toLowerCase()} shrink-0`}
          style={{ width: "13px", height: "9px", borderRadius: "1px", display: "inline-block" }}
        />
      )}
      {noc}
    </span>
  );
}

function parseHash(hash: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(hash.replace(/^#/, "")));
}

function buildHash(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `#${s}` : "";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RangiranjeClient({
  activeCode,
  isAP,
  shooters,
  categoriesPresent,
  labels,
  locale,
}: Props) {
  const t = useTranslations("ranking");
  // Podrazumevano "Sve"; senior (i mlađi senior) nisu poseban filter — to je "Sve" bez mlađih.
  const filterCategories: AgeCategory[] = categoriesPresent.filter((c) => c !== "senior" && c !== "mladji_senior" && c !== "pionir");
  const defaultKategorija: AgeCategory | null = null;

  const [activeView, setActiveView] = useState<ViewKey>("forma");
  const [activeKategorija, setActiveKategorija] = useState<AgeCategory | null>(
    defaultKategorija as AgeCategory | null
  );
  const [activeZemlja, setActiveZemlja] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<PeriodType>("karijera");
  const [seasonYear, setSeasonYear] = useState<number>(() => currentSeasonStartYear("vazdusna"));
  // Desktop tabela: sortiranje po koloni
  const [sortKey, setSortKey] = useState<SortKey>("forma");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // Read initial state from URL hash (client-only, runs once on mount)
  useEffect(() => {
    const h = parseHash(window.location.hash);
    void Promise.resolve().then(() => {
      if (h.view && VIEWS.some((v) => v.key === h.view)) setActiveView(h.view as ViewKey);
      if (h.kategorija && filterCategories.includes(h.kategorija as AgeCategory)) {
        setActiveKategorija(h.kategorija as AgeCategory);
      }
      if (h.zemlja) setActiveZemlja(h.zemlja);
      if (h.period && ["karijera", "kalendarska"].includes(h.period)) {
        setActivePeriod(h.period as PeriodType);
      }
      if (h.sezona && !isNaN(parseInt(h.sezona))) setSeasonYear(parseInt(h.sezona));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state → URL hash (shareable links)
  useEffect(() => {
    const hash = buildHash({
      view:      activeView !== "forma" ? activeView : undefined,
      kategorija: activeKategorija && activeKategorija !== defaultKategorija ? activeKategorija : undefined,
      zemlja:    activeZemlja ?? undefined,
      period:    activePeriod !== "karijera" ? activePeriod : undefined,
      sezona:    activePeriod !== "karijera" ? String(seasonYear) : undefined,
    });
    history.replaceState(null, "", hash || window.location.pathname + window.location.search);
  }, [activeView, activeKategorija, activeZemlja, activePeriod, seasonYear, defaultKategorija]);

  const seasonType: SeasonType = activePeriod === "karijera" ? "vazdusna" : activePeriod;
  // Fiksna lista godina: od tekuće do godine najranijeg rezultata (ne zavisi od izabrane godine)
  const seasonPeriods = useMemo(() => {
    let minYear = Infinity;
    for (const sh of shooters) for (const m of sh.matches) minYear = Math.min(minYear, Number(m.date.slice(0, 4)));
    const top = currentSeasonStartYear(seasonType);
    const from = Number.isFinite(minYear) ? Math.min(minYear, top) : top;
    return Array.from({ length: top - from + 1 }, (_, i) => top - i);
  }, [shooters, seasonType]);

  // ── Computed data ────────────────────────────────────────────────────────────

  const categoryRows = useMemo(
    () => (activeKategorija ? shooters.filter((s) => s.category === activeKategorija) : shooters),
    [shooters, activeKategorija]
  );

  const allNocs = useMemo(
    () =>
      Array.from(new Set(categoryRows.map((s) => s.nationality).filter(Boolean) as string[])).sort(),
    [categoryRows]
  );

  const nocOptions = useMemo(
    () => {
      const regionNames = locale === "en" ? new Intl.DisplayNames("en", { type: "region" }) : null;
      return allNocs.map((noc) => {
        const a2 = nocAlpha2(noc);
        const entry = NOC_LIST.find((n) => n.noc === noc);
        // NOC_LIST ima samo srpska imena; za en uzimamo ime iz Intl (AIN i sl. nemaju region kod).
        const enName = a2 && a2.length === 2 ? regionNames?.of(a2) : undefined;
        return {
          value: noc,
          label: noc,
          sublabel: locale === "en" ? (enName ?? (noc === "AIN" ? "Individual Neutral Athletes" : entry?.name)) : entry?.name,
          keywords: countryKeywords(a2, entry?.name),
          prefix: a2 ? <span className={`fi fi-${a2.toLowerCase()}`} style={{ fontSize: "0.95em", borderRadius: 2 }} /> : undefined,
        };
      });
    },
    [allNocs, locale]
  );

  const allRanked = useMemo(() => {
    const seasonWin     = seasonWindow(seasonType, seasonYear);
    const prevSeasonWin = seasonWindow(seasonType, seasonYear - 1);

    return categoryRows.map((s) => {
      const entries = s.matches as MetricEntry[];

      // Period-filtered entries for active view
      const windowEntries = filterByPeriod(entries, activePeriod, seasonYear);
      const peakActive    = windowEntries.length > 0 ? Math.max(...windowEntries.map((e) => e.qualTotal)) : null;
      const best3Active   = computeAvgOfTopN(windowEntries, 3);
      const recent3Active = computeRecentAvg(windowEntries, 3);
      const avgActive     = computeMean(windowEntries);
      const periodCount   = windowEntries.length;

      // Improvement for active season type (may differ from cached vazdusna default)
      const { avg: seasonAvg, count: seasonCount } = computeSeasonAvg(entries, seasonWin);
      const { avg: prevSeasonAvg }                  = computeSeasonAvg(entries, prevSeasonWin);
      const improvement =
        seasonAvg != null && prevSeasonAvg != null ? seasonAvg - prevSeasonAvg : null;

      // Δ vs. prošla godina (desktop tabela): kalendarska godina — izabrana, ili tekuća za Karijeru
      const deltaYearBase = activePeriod === "kalendarska" ? seasonYear : currentSeasonStartYear("kalendarska");
      const { avg: yAvg }     = computeSeasonAvg(entries, seasonWindow("kalendarska", deltaYearBase));
      const { avg: yPrevAvg } = computeSeasonAvg(entries, seasonWindow("kalendarska", deltaYearBase - 1));
      const deltaYear = yAvg != null && yPrevAvg != null ? yAvg - yPrevAvg : null;

      return {
        ...s,
        deltaYear,
        peakActive,
        best3Active,
        recent3Active,
        avgActive,
        periodCount,
        seasonAvg,
        seasonCount,
        improvement,
      };
    });
  }, [categoryRows, activePeriod, seasonYear, seasonType]);

  const zFiltered = useMemo(
    () => (activeZemlja ? allRanked.filter((s) => s.nationality === activeZemlja) : allRanked),
    [allRanked, activeZemlja]
  );

  const displayed = useMemo(() => {
    switch (activeView) {
      case "forma":
        return [...zFiltered]
          .filter((s) => s.forma !== null)
          .sort((a, b) => {
            const fa = a.forma ?? 0, fb = b.forma ?? 0;
            if (fb !== fa) return fb - fa;
            if ((b.peakCareer ?? 0) !== (a.peakCareer ?? 0)) return (b.peakCareer ?? 0) - (a.peakCareer ?? 0);
            return b.formaSampleSize - a.formaSampleSize;
          });
      case "peak":
        return [...zFiltered].filter((s) => s.peakActive !== null).sort((a, b) => b.peakActive! - a.peakActive!);
      case "best3":
        return [...zFiltered].filter((s) => s.best3Active !== null).sort((a, b) => b.best3Active! - a.best3Active!);
      case "seasonavg":
        return [...zFiltered].filter((s) => s.avgActive !== null).sort((a, b) => b.avgActive! - a.avgActive!);
      case "recent3":
        return [...zFiltered].filter((s) => s.recent3Active !== null).sort((a, b) => b.recent3Active! - a.recent3Active!);
      case "improved":
        return [...zFiltered].filter((s) => s.improvement !== null).sort((a, b) => b.improvement! - a.improvement!);
    }
  }, [zFiltered, activeView]);

  const desktopRows = useMemo(() => {
    const val = (s: (typeof zFiltered)[number]): number | null => {
      switch (sortKey) {
        case "forma":   return s.forma;
        case "peak":    return s.peakActive;
        case "best3":   return s.best3Active;
        case "avg":     return s.avgActive;
        case "recent3": return s.recent3Active;
        case "delta":   return s.deltaYear;
        case "count":   return s.periodCount;
      }
    };
    const dir = sortDir === "desc" ? -1 : 1;
    return zFiltered
      .filter((s) => val(s) !== null && (sortKey !== "count" || s.periodCount > 0))
      .sort((a, b) => {
        const d = (val(a)! - val(b)!) * dir;
        if (d !== 0) return d;
        return (b.forma ?? 0) - (a.forma ?? 0) || (b.peakCareer ?? 0) - (a.peakCareer ?? 0) || b.formaSampleSize - a.formaSampleSize;
      });
  }, [zFiltered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handlePeriodChange = useCallback((pt: PeriodType) => {
    const effectivePeriod: PeriodType =
      NO_CAREER_VIEWS.includes(activeView) && pt === "karijera" ? "kalendarska" : pt;
    setActivePeriod(effectivePeriod);
    if (effectivePeriod !== "karijera") {
      setSeasonYear(currentSeasonStartYear(effectivePeriod as SeasonType));
    }
  }, [activeView]);

  const showPeriodControl = PERIOD_VIEWS.includes(activeView) || IMPROVED_VIEWS.includes(activeView);

  const renderPeriodControl = (periods: PeriodType[], onPick: (pt: PeriodType) => void) => (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
          <div className="flex items-center gap-1">
            {periods.map((pt) => (
              <button
                key={pt}
                aria-pressed={activePeriod === pt}
                onClick={() => onPick(pt)}
                className="px-3 py-2 rounded-md text-xs md:text-sm font-semibold transition-colors"
                style={
                  activePeriod === pt
                    ? { background: "var(--ink)", color: "var(--bg)" }
                    : { background: "var(--surface-2)", color: "var(--muted)" }
                }
              >
                {pt === "karijera"
                  ? labels.periodCareer
                  : labels.seasonCalendar}
              </button>
            ))}
          </div>
          {activePeriod !== "karijera" && (
            <>
              <span className="text-[var(--border-strong)]" aria-hidden="true">·</span>
              <div className="flex items-center gap-1 flex-wrap">
                {seasonPeriods.map((y) => (
                  <button
                    key={y}
                    aria-pressed={seasonYear === y}
                    onClick={() => setSeasonYear(y)}
                    className="px-2 py-2 rounded-md text-[0.7rem] font-[family-name:var(--font-jetbrains-mono)] font-semibold transition-colors"
                    style={
                      seasonYear === y
                        ? { background: "var(--brand-primary)", color: "white" }
                        : { background: "var(--surface-2)", color: "var(--muted)" }
                    }
                  >
                    {formatSeasonLabel(seasonType, y)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Category tabs */}
      {filterCategories.length > 0 && (
        <div className="flex items-center gap-1 sm:gap-2 mb-4 flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible">
          <span className="hidden sm:block w-16 shrink-0 mr-1 text-xs font-bold uppercase tracking-wider text-[var(--subtle)]">
            {locale === "en" ? "Age" : "Uzrast"}
          </span>
          <button
            aria-pressed={activeKategorija === null}
            onClick={() => setActiveKategorija(null)}
            className="inline-flex items-center justify-center flex-none shrink-0 px-2.5 sm:px-4 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
            style={
              activeKategorija === null
                ? { background: "var(--brand-primary)", color: "white" }
                : { background: "transparent", color: "var(--muted)", border: "1px solid var(--border)" }
            }
          >
            {labels.all}
          </button>
          {filterCategories.map((cat) => {
            const active = activeKategorija === cat;
            return (
              <button
                key={cat}
                aria-pressed={active}
                onClick={() => setActiveKategorija(cat)}
                className="inline-flex items-center justify-center flex-1 sm:flex-none shrink-0 px-1.5 sm:px-4 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
                style={
                  active
                    ? { background: "var(--brand-primary)", color: "white" }
                    : { background: "transparent", color: "var(--muted)", border: "1px solid var(--border)" }
                }
              >
                {categoryLabel(cat, locale)}
              </button>
            );
          })}
        </div>
      )}

      {/* View selector */}
      <div className="md:hidden flex items-center gap-1 mb-4 flex-nowrap overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
        {VIEWS.map(({ key, labelKey }) => {
          const active = activeView === key;
          return (
            <button
              key={key}
              aria-pressed={active}
              onClick={() => {
                setActiveView(key);
                // "improved" / "recent3" don't allow "karijera" period
                if (NO_CAREER_VIEWS.includes(key) && activePeriod === "karijera") {
                  setActivePeriod("kalendarska");
                  setSeasonYear(currentSeasonStartYear("kalendarska"));
                }
              }}
              className="inline-flex items-center shrink-0 px-3 py-2 rounded-full text-xs font-semibold transition-colors border"
              style={
                active
                  ? { background: "var(--brand-primary)", color: "white", borderColor: "var(--brand-primary)" }
                  : { background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }
              }
            >
              {key === "forma" ? <FormaScoreMark size="sm" inverted={active} /> : labels[labelKey] as string}
            </button>
          );
        })}
      </div>

      {/* Period control (mobilni: zavisi od pogleda) */}
      {showPeriodControl && (
        <div className="md:hidden">
          {renderPeriodControl(
            NO_CAREER_VIEWS.includes(activeView) ? ["kalendarska"] : ["karijera", "kalendarska"],
            handlePeriodChange
          )}
        </div>
      )}
      {/* Desktop: period i zemlja u jednom redu */}
      <div className="md:flex md:items-center md:gap-4 md:flex-wrap md:mb-5">
      <div className="hidden md:block [&>div]:mb-0">
        {renderPeriodControl(["karijera", "kalendarska"], (pt) => {
          setActivePeriod(pt);
          if (pt !== "karijera") setSeasonYear(currentSeasonStartYear(pt as SeasonType));
        })}
      </div>

      {/* Country filter */}
      {allNocs.length > 1 && (
        <div className="flex items-center gap-3 mb-5 md:mb-0">
          <SearchDropdown
            className="w-52"
            value={activeZemlja ?? ""}
            onChange={(v) => setActiveZemlja(v || null)}
            options={nocOptions}
            placeholder={`${labels.country}: ${labels.all}`}
            emptyLabel={labels.all}
            searchPlaceholder={`${labels.country}…`}
            labelClassName="font-[family-name:var(--font-jetbrains-mono)] font-semibold"
          />
          <span className="text-xs text-[var(--muted)] ml-1 font-[family-name:var(--font-jetbrains-mono)] tabular-nums">
            <span className="md:hidden">{displayed.length}</span>
            <span className="hidden md:inline">{desktopRows.length}</span>
          </span>
        </div>
      )}
      </div>

      {/* Desktop: sve statistike u jednoj tabeli, sortiranje klikom na zaglavlje */}
      <div className="hidden md:block">
        {desktopRows.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] py-20 text-center">
            <p className="text-sm text-[var(--muted)]">{labels.noData}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <caption className="sr-only">{labels.activeTabLabel} — {labels.title}</caption>
              <thead>
                <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                  <th scope="col" className={`${TH} text-right w-12`}>#</th>
                  <th scope="col" className={`${TH} text-left`}>{labels.shooter}</th>
                  <th scope="col" className={`${TH} text-left`}>{labels.country}</th>
                  {([
                    ["forma",   <FormaScoreMark key="f" size="sm" />],
                    ["peak",    labels.viewPeak],
                    ["best3",   labels.viewBest3],
                    ["avg",     labels.viewSeasonAvg],
                    ["recent3", labels.viewRecent3],
                    ["delta",   labels.improvedCol],
                  ] as [SortKey, React.ReactNode][]).map(([key, label]) => (
                    <th
                      key={key}
                      scope="col"
                      aria-sort={sortKey === key ? (sortDir === "desc" ? "descending" : "ascending") : "none"}
                      className={`${TH} text-right`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(key)}
                        className={`inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-wider hover:text-[var(--ink)] transition-colors ${sortKey === key ? "text-[var(--ink)]" : ""}`}
                      >
                        {label}
                        <span aria-hidden="true" className="text-[0.55rem]">
                          {sortKey === key ? (sortDir === "desc" ? "▼" : "▲") : ""}
                        </span>
                      </button>
                    </th>
                  ))}
                  {isAP && <th scope="col" className={`${TH} text-right`}>{labels.inners}</th>}
                  <th
                    scope="col"
                    aria-sort={sortKey === "count" ? (sortDir === "desc" ? "descending" : "ascending") : "none"}
                    className={`${TH} text-right`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("count")}
                      className={`inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-wider hover:text-[var(--ink)] transition-colors ${sortKey === "count" ? "text-[var(--ink)]" : ""}`}
                    >
                      {activePeriod === "karijera" ? labels.appearances : labels.inSeason}
                      <span aria-hidden="true" className="text-[0.55rem]">
                        {sortKey === "count" ? (sortDir === "desc" ? "▼" : "▲") : ""}
                      </span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {desktopRows.map((s, i) => {
                  const rank = i + 1;
                  const num = "px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] tabular-nums";
                  const dash = <span className="text-[var(--subtle)]">—</span>;
                  const cell = (v: number | null, key: SortKey) => (
                    <td className={`${num} ${sortKey === key ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                      {v !== null ? v.toFixed(1) : dash}
                    </td>
                  );
                  return (
                    <tr key={s.shooterId} className="group hover:bg-[var(--surface)] transition-colors">
                      <td className="w-12 px-4 py-3 text-right">
                        <span
                          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold tabular-nums leading-none"
                          style={{
                            fontSize: rank === 1 ? "1.2rem" : rank <= 3 ? "1rem" : "0.875rem",
                            color: rank === 1 ? "var(--rank-accent)" : rank <= 3 ? "var(--ink)" : "var(--muted)",
                          }}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ScopedLink
                          href={`/strelci/${s.shooterId}`}
                          className="font-semibold text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors"
                        >
                          {s.lastName} {s.firstName}
                        </ScopedLink>
                      </td>
                      <td className="px-4 py-3"><FlagChip noc={s.nationality} /></td>
                      <td className={`${num} ${sortKey === "forma" ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                        {s.forma !== null ? (
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {s.forma.toFixed(1)}
                            <span className="font-bold text-xs" style={{ color: trendColor(s.formaTrend) }}>{trendLabel(s.formaTrend)}</span>
                          </span>
                        ) : dash}
                      </td>
                      {cell(s.peakActive, "peak")}
                      {cell(s.best3Active, "best3")}
                      {cell(s.avgActive, "avg")}
                      {cell(s.recent3Active, "recent3")}
                      <td className={`${num} ${sortKey === "delta" ? "font-bold" : ""}`}
                        style={{ color: s.deltaYear === null ? "var(--subtle)" : s.deltaYear > 0 ? "var(--success)" : s.deltaYear < 0 ? "var(--brand-primary)" : "var(--ink)" }}
                      >
                        {s.deltaYear !== null ? `${s.deltaYear > 0 ? "+" : ""}${s.deltaYear.toFixed(1)}` : "—"}
                      </td>
                      {isAP && (
                        <td className={`${num} text-xs text-[var(--muted)]`}>
                          {s.bestInners != null ? `${s.bestInners}×` : dash}
                        </td>
                      )}
                      <td className={`${num} text-xs ${sortKey === "count" ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                        {s.periodCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)]">
                {t("shootersCount", { count: desktopRows.length })} · {labels.activeTabLabel}
                {activeKategorija ? ` · ${categoryLabel(activeKategorija, locale)}` : ""}
                {activeZemlja ? ` · ${activeZemlja}` : ""}
              </span>
              </div>
          </div>
        )}
      </div>

      <div className="md:hidden">
      {displayed.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] py-20 text-center">
          <p className="text-sm text-[var(--muted)]">{labels.noData}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <caption className="sr-only">{labels.activeTabLabel} — {labels.title}</caption>
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <th scope="col" className={`${TH} text-right w-12`}>#</th>
                <th scope="col" className={`${TH} text-left`}>{labels.shooter}</th>
                <th scope="col" className={`${TH} text-left hidden md:table-cell`}>{labels.country}</th>
                <th scope="col" className={`${TH} text-right`}>
                  {activeView === "forma" ? <FormaScoreMark size="sm" /> : activeView === "improved"
                    ? labels.improvedCol
                    : labels[VIEWS.find((v) => v.key === activeView)!.labelKey] as string}
                </th>
                {(activeView === "forma" || activePeriod !== "karijera") && (
                  <th scope="col" className={`${TH} text-right hidden sm:table-cell`}>
                    {activeView === "forma" ? labels.peak : labels.inSeason}
                  </th>
                )}
                {isAP && (
                  <th scope="col" className={`${TH} text-right hidden sm:table-cell`}>{labels.inners}</th>
                )}
                <th scope="col" className={`${TH} text-right hidden md:table-cell`}>{labels.appearances}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {displayed.map((s, i) => {
                const rank   = i + 1;
                const isFirst = rank === 1;
                const isTop3  = rank <= 3;

                return (
                  <tr key={s.shooterId} className="group hover:bg-[var(--surface)] transition-colors">
                    {/* Rank */}
                    <td className="w-12 px-4 py-3 text-right">
                      <span
                        className="font-[family-name:var(--font-barlow-condensed)] font-extrabold tabular-nums leading-none"
                        style={{
                          fontSize: isFirst ? "1.2rem" : isTop3 ? "1rem" : "0.875rem",
                          color: isFirst ? "var(--rank-accent)" : isTop3 ? "var(--ink)" : "var(--muted)",
                        }}
                      >
                        {rank}
                      </span>
                    </td>

                    {/* Strelac */}
                    <td className="px-4 py-3">
                      <ScopedLink
                        href={`/strelci/${s.shooterId}`}
                        className="font-semibold text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors"
                      >
                        {s.lastName} {s.firstName}
                      </ScopedLink>
                      {s.nationality && (
                        <span className="flex items-center gap-1 mt-0.5 md:hidden">
                          {(() => {
                            const a2 = nocAlpha2(s.nationality);
                            return a2 ? (
                              <span
                                className={`fi fi-${a2.toLowerCase()} shrink-0`}
                                style={{ width: "12px", height: "8px", borderRadius: "1px", display: "inline-block" }}
                              />
                            ) : null;
                          })()}
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] text-[var(--muted)]">
                            {s.nationality}
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Zemlja */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <FlagChip noc={s.nationality} />
                    </td>

                    {/* Primary metric */}
                    <td className="px-4 py-3 text-right">
                      {activeView === "forma" && (
                        s.forma !== null ? (
                          <span className="inline-flex items-center justify-end gap-1.5">
                            <span
                              className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]"
                              style={{ fontSize: isTop3 ? "1rem" : "0.875rem" }}
                            >
                              {s.forma.toFixed(1)}
                            </span>
                            <span
                              className="font-bold text-xs font-[family-name:var(--font-jetbrains-mono)]"
                              style={{ color: trendColor(s.formaTrend) }}
                            >
                              {trendLabel(s.formaTrend)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--subtle)]">—</span>
                        )
                      )}
                      {activeView === "peak" && (
                        <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]" style={{ fontSize: isTop3 ? "1rem" : "0.875rem" }}>
                          {s.peakActive!.toFixed(1)}
                        </span>
                      )}
                      {activeView === "best3" && (
                        <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]" style={{ fontSize: isTop3 ? "1rem" : "0.875rem" }}>
                          {s.best3Active!.toFixed(1)}
                        </span>
                      )}
                      {activeView === "seasonavg" && (
                        <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]" style={{ fontSize: isTop3 ? "1rem" : "0.875rem" }}>
                          {s.avgActive!.toFixed(1)}
                        </span>
                      )}
                      {activeView === "recent3" && (
                        <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]" style={{ fontSize: isTop3 ? "1rem" : "0.875rem" }}>
                          {s.recent3Active!.toFixed(1)}
                        </span>
                      )}
                      {activeView === "improved" && (
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <span
                            className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums"
                            style={{
                              fontSize: isTop3 ? "1rem" : "0.875rem",
                              color: s.improvement! > 0 ? "var(--success)" : s.improvement! < 0 ? "var(--brand-primary)" : "var(--ink)",
                            }}
                          >
                            {s.improvement! > 0 ? "+" : ""}{s.improvement!.toFixed(1)}
                          </span>
                          <span className="text-xs text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)]">
                            → {s.seasonAvg!.toFixed(1)}
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Secondary column */}
                    {(activeView === "forma" || activePeriod !== "karijera") && (
                      <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm text-[var(--muted)] tabular-nums hidden sm:table-cell">
                        {activeView === "forma" ? (
                          s.peakCareer !== null ? s.peakCareer.toFixed(1) : <span className="text-[var(--subtle)]">—</span>
                        ) : activeView === "improved" ? (
                          s.seasonCount
                        ) : (
                          s.periodCount
                        )}
                      </td>
                    )}

                    {/* Inners (AP only) */}
                    {isAP && (
                      <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] tabular-nums hidden sm:table-cell">
                        {s.bestInners != null ? `${s.bestInners}×` : <span className="text-[var(--subtle)]">—</span>}
                      </td>
                    )}

                    {/* Nastupa */}
                    <td className="px-4 py-3 text-right text-xs text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)] tabular-nums hidden md:table-cell">
                      {s.matches.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer */}
          <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)]">
              {t("shootersCount", { count: displayed.length })} · {labels.activeTabLabel}
              {activeKategorija ? ` · ${categoryLabel(activeKategorija, locale)}` : ""}
              {activeZemlja ? ` · ${activeZemlja}` : ""}
            </span>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
