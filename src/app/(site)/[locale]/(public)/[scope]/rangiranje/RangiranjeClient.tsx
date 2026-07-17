"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ScopedLink } from "../../components/ScopedLink";
import { NOC_LIST } from "@/lib/noc-list";
import {
  trendLabel,
  trendColor,
  RANKING_MIN_SAMPLE,
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
import { CATEGORY_LABEL, type AgeCategory } from "@/lib/pdf-import/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type DiscCode = "ARM" | "ARW" | "APM" | "APW";
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
  footerSubtitle: string;
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

const TH = "px-4 py-3 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] select-none";

// ── Helpers ───────────────────────────────────────────────────────────────────

function nocAlpha2(noc: string | null): string | null {
  if (!noc) return null;
  return NOC_LIST.find((n) => n.noc === noc)?.alpha2 ?? null;
}

function FlagChip({ noc, inline = false }: { noc: string | null; inline?: boolean }) {
  if (!noc) return <span className="text-[var(--subtle)]">—</span>;
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
  const defaultKategorija = categoriesPresent.includes("senior")
    ? "senior"
    : categoriesPresent[0] ?? null;

  const [activeView, setActiveView] = useState<ViewKey>("forma");
  const [activeKategorija, setActiveKategorija] = useState<AgeCategory | null>(
    defaultKategorija as AgeCategory | null
  );
  const [activeZemlja, setActiveZemlja] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<PeriodType>("karijera");
  const [seasonYear, setSeasonYear] = useState<number>(() => currentSeasonStartYear("vazdusna"));

  // Read initial state from URL hash (client-only, runs once on mount)
  useEffect(() => {
    const h = parseHash(window.location.hash);
    void Promise.resolve().then(() => {
      if (h.view && VIEWS.some((v) => v.key === h.view)) setActiveView(h.view as ViewKey);
      if (h.kategorija && categoriesPresent.includes(h.kategorija as AgeCategory)) {
        setActiveKategorija(h.kategorija as AgeCategory);
      }
      if (h.zemlja) setActiveZemlja(h.zemlja);
      if (h.period && ["karijera", "vazdusna", "kalendarska"].includes(h.period)) {
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
  const seasonPeriods = [seasonYear, seasonYear - 1, seasonYear - 2, seasonYear - 3, seasonYear - 4];

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

      return {
        ...s,
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
          .filter((s) => s.formaSampleSize >= RANKING_MIN_SAMPLE)
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

  const handlePeriodChange = useCallback((pt: PeriodType) => {
    const effectivePeriod: PeriodType =
      IMPROVED_VIEWS.includes(activeView) && pt === "karijera" ? "vazdusna" : pt;
    setActivePeriod(effectivePeriod);
    if (effectivePeriod !== "karijera") {
      setSeasonYear(currentSeasonStartYear(effectivePeriod as SeasonType));
    }
  }, [activeView]);

  const showPeriodControl = PERIOD_VIEWS.includes(activeView) || IMPROVED_VIEWS.includes(activeView);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Category tabs */}
      {categoriesPresent.length > 1 && (
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          <button
            onClick={() => setActiveKategorija(null)}
            className="inline-flex items-center px-2.5 py-1 rounded-md text-[0.7rem] font-semibold transition-colors"
            style={
              activeKategorija === null
                ? { background: "var(--brand-primary)", color: "white" }
                : { background: "transparent", color: "var(--subtle)", border: "1px solid var(--border)" }
            }
          >
            {labels.all}
          </button>
          {categoriesPresent.filter((cat) => cat !== "mladji_senior").map((cat) => {
            const active = activeKategorija === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveKategorija(cat)}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-[0.7rem] font-semibold transition-colors"
                style={
                  active
                    ? { background: "var(--brand-primary)", color: "white" }
                    : { background: "transparent", color: "var(--subtle)", border: "1px solid var(--border)" }
                }
              >
                {CATEGORY_LABEL[cat]}
              </button>
            );
          })}
        </div>
      )}

      {/* View selector */}
      <div className="flex items-center gap-1 mb-4 flex-nowrap overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
        {VIEWS.map(({ key, labelKey }) => {
          const active = activeView === key;
          return (
            <button
              key={key}
              onClick={() => {
                setActiveView(key);
                // "improved" doesn't allow "karijera" period
                if (IMPROVED_VIEWS.includes(key) && activePeriod === "karijera") {
                  setActivePeriod("vazdusna");
                  setSeasonYear(currentSeasonStartYear("vazdusna"));
                }
              }}
              className="inline-flex items-center shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border"
              style={
                active
                  ? { background: "var(--brand-primary)", color: "white", borderColor: "var(--brand-primary)" }
                  : { background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }
              }
            >
              {labels[labelKey] as string}
            </button>
          );
        })}
      </div>

      {/* Period control */}
      {showPeriodControl && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
          <div className="flex items-center gap-1">
            {(PERIOD_VIEWS.includes(activeView)
              ? (["karijera", "vazdusna", "kalendarska"] as PeriodType[])
              : (["vazdusna", "kalendarska"] as PeriodType[])
            ).map((pt) => (
              <button
                key={pt}
                onClick={() => handlePeriodChange(pt)}
                className="px-2.5 py-1 rounded-md text-[0.7rem] font-semibold transition-colors"
                style={
                  activePeriod === pt
                    ? { background: "var(--ink)", color: "var(--bg)" }
                    : { background: "var(--surface-2)", color: "var(--muted)" }
                }
              >
                {pt === "karijera"
                  ? labels.periodCareer
                  : pt === "vazdusna"
                  ? labels.seasonAir
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
                    onClick={() => setSeasonYear(y)}
                    className="px-2 py-1 rounded-md text-[0.7rem] font-[family-name:var(--font-jetbrains-mono)] font-semibold transition-colors"
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
      )}

      {/* Country filter */}
      {allNocs.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 mb-5">
          <button
            onClick={() => setActiveZemlja(null)}
            className="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors font-[family-name:var(--font-jetbrains-mono)]"
            style={
              !activeZemlja
                ? { background: "var(--ink)", color: "var(--bg)" }
                : { background: "var(--surface-2)", color: "var(--muted)" }
            }
          >
            {labels.all}
          </button>
          {allNocs.map((noc) => {
            const a2 = nocAlpha2(noc);
            const active = activeZemlja === noc;
            return (
              <button
                key={noc}
                onClick={() => setActiveZemlja(active ? null : noc)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors font-[family-name:var(--font-jetbrains-mono)]"
                style={
                  active
                    ? { background: "var(--ink)", color: "var(--bg)" }
                    : { background: "var(--surface-2)", color: "var(--muted)" }
                }
              >
                {a2 && (
                  <span
                    className={`fi fi-${a2.toLowerCase()} shrink-0`}
                    style={{ width: "13px", height: "9px", borderRadius: "1px", display: "inline-block" }}
                  />
                )}
                {noc}
              </button>
            );
          })}
          <span className="text-xs text-[var(--subtle)] ml-1 font-[family-name:var(--font-jetbrains-mono)] tabular-nums">
            {displayed.length}
          </span>
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] py-20 text-center">
          <p className="text-sm text-[var(--muted)]">{labels.noData}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <th className={`${TH} text-right w-12`}>#</th>
                <th className={`${TH} text-left`}>{labels.shooter}</th>
                <th className={`${TH} text-left hidden md:table-cell`}>{labels.country}</th>
                <th className={`${TH} text-left hidden lg:table-cell`}>{labels.club}</th>
                <th className={`${TH} text-right`}>
                  {activeView === "improved"
                    ? labels.improvedCol
                    : labels[VIEWS.find((v) => v.key === activeView)!.labelKey] as string}
                </th>
                <th className={`${TH} text-right hidden sm:table-cell`}>
                  {activeView === "forma" ? labels.peak : labels.inSeason}
                </th>
                {isAP && (
                  <th className={`${TH} text-right hidden sm:table-cell`}>{labels.inners}</th>
                )}
                <th className={`${TH} text-right hidden md:table-cell`}>{labels.appearances}</th>
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
                          color: isFirst ? "var(--brand-primary)" : isTop3 ? "var(--ink)" : "var(--subtle)",
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

                    {/* Klub */}
                    <td className="px-4 py-3 text-[var(--muted)] hidden lg:table-cell">
                      {s.clubName ?? <span className="text-[var(--subtle)]">—</span>}
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
                          <span className="text-xs text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)]">
                            → {s.seasonAvg!.toFixed(1)}
                          </span>
                        </span>
                      )}
                    </td>

                    {/* Secondary column */}
                    <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm text-[var(--muted)] tabular-nums hidden sm:table-cell">
                      {activeView === "forma" ? (
                        s.peakCareer !== null ? s.peakCareer.toFixed(1) : <span className="text-[var(--subtle)]">—</span>
                      ) : activeView === "improved" ? (
                        s.seasonCount
                      ) : (
                        s.periodCount
                      )}
                    </td>

                    {/* Inners (AP only) */}
                    {isAP && (
                      <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] tabular-nums hidden sm:table-cell">
                        {s.bestInners != null ? `${s.bestInners}×` : <span className="text-[var(--subtle)]">—</span>}
                      </td>
                    )}

                    {/* Nastupa */}
                    <td className="px-4 py-3 text-right text-xs text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] tabular-nums hidden md:table-cell">
                      {s.matches.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer */}
          <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)]">
              {t("shootersCount", { count: displayed.length })} · {labels.activeTabLabel}
              {activeKategorija ? ` · ${CATEGORY_LABEL[activeKategorija]}` : ""}
              {activeZemlja ? ` · ${activeZemlja}` : ""}
            </span>
            <span className="text-xs text-[var(--subtle)]">{labels.footerSubtitle}</span>
          </div>
        </div>
      )}

      {/* H2H link */}
      <div className="mt-3 flex justify-end">
        <ScopedLink
          href={`/head-to-head?disc=${activeCode.toLowerCase()}`}
          className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors font-[family-name:var(--font-jetbrains-mono)]"
        >
          {locale === "en" ? "Head-to-head comparison" : "Head-to-head poređenje"} →
        </ScopedLink>
      </div>
    </>
  );
}
