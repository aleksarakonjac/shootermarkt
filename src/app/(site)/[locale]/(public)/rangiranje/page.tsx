export const revalidate = 300;

import { db } from "@/lib/db";
import { shooters, clubs, results, disciplines, competitions } from "@/lib/db/schema";
import { eq, isNotNull, and, inArray, asc } from "drizzle-orm";
import { MVP_APPARATUS } from "@/lib/mvp-scope";
import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";
import {
  computeFormaFromEntries,
  trendLabel,
  trendColor,
  RANKING_MIN_SAMPLE,
  type CompetitionLevel,
  type Trend,
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
} from "@/lib/ranking-metrics";
import { CATEGORY_LABEL, CATEGORY_RANK, type AgeCategory } from "@/lib/pdf-import/types";
import { NOC_LIST } from "@/lib/noc-list";
import { getLocale, getTranslations } from "next-intl/server";
import { buildAlternates } from "@/i18n/alternates";
import { HeadToHeadPanel, type H2HCandidate, type H2HLabels } from "./HeadToHeadPanel";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("ranking"), getLocale()]);
  return {
    title: t("title"),
    alternates: buildAlternates(locale, "/rangiranje"),
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

type DiscCode = "ARM" | "ARW" | "APM" | "APW";
type ViewKey = "forma" | "peak" | "best3" | "seasonavg" | "recent3" | "improved" | "h2h";

const TABS: { code: DiscCode; label: string; labelEn: string }[] = [
  { code: "ARM", label: "10m puška M", labelEn: "10m Air Rifle Men" },
  { code: "ARW", label: "10m puška Ž", labelEn: "10m Air Rifle Women" },
  { code: "APM", label: "10m pištolj M", labelEn: "10m Air Pistol Men" },
  { code: "APW", label: "10m pištolj Ž", labelEn: "10m Air Pistol Women" },
];

const VIEWS: { key: ViewKey; labelKey: string }[] = [
  { key: "forma",     labelKey: "viewForma" },
  { key: "peak",       labelKey: "viewPeak" },
  { key: "best3",      labelKey: "viewBest3" },
  { key: "seasonavg",  labelKey: "viewSeasonAvg" },
  { key: "recent3",    labelKey: "viewRecent3" },
  { key: "improved",   labelKey: "viewImproved" },
  { key: "h2h",        labelKey: "viewH2H" },
];

/** Views koji nude puni 3-way period toggle (Karijera/Sezona/Kalendarska godina). */
const PERIOD_VIEWS: ViewKey[] = ["peak", "best3", "seasonavg", "recent3"];
/** "Najviše napredovao" računa deltu između dva UZASTOPNA perioda — "karijera" nema smisla tu. */
const IMPROVED_VIEWS: ViewKey[] = ["improved"];

const TH =
  "px-4 py-3 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)] select-none";

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

// ── Page ─────────────────────────────────────────────────────────────────────

type Props = {
  searchParams: Promise<{
    disciplina?: string;
    kategorija?: string;
    view?: string;
    zemlja?: string;
    sezona?: string;
    sezonaTip?: string;
  }>;
};

export default async function RangiranjeePage({ searchParams }: Props) {
  const locale = await getLocale();
  const t = await getTranslations("ranking");
  const tCommon = await getTranslations("common");

  const { disciplina, kategorija, view, zemlja, sezona, sezonaTip } = await searchParams;

  const validCode = TABS.find((tab) => tab.code === disciplina?.toUpperCase())?.code;
  const activeCode: DiscCode = validCode ?? "ARM";
  const activeZemlja = zemlja?.toUpperCase() ?? null;
  const activeView: ViewKey = VIEWS.find((v) => v.key === view)?.key ?? "forma";

  // Period toggle: PERIOD_VIEWS allow karijera/sezona/kalendarska; improved allows only
  // sezona/kalendarska (potreban je ograničen prozor da postoji "prethodni period").
  const requestedPeriod: PeriodType =
    sezonaTip === "kalendarska" ? "kalendarska" : sezonaTip === "karijera" ? "karijera" : "vazdusna";
  const activePeriod: PeriodType = IMPROVED_VIEWS.includes(activeView) && requestedPeriod === "karijera"
    ? "vazdusna"
    : requestedPeriod;
  const seasonType: SeasonType = activePeriod === "karijera" ? "vazdusna" : activePeriod;
  const seasonYear = sezona && !isNaN(parseInt(sezona)) ? parseInt(sezona) : currentSeasonStartYear(seasonType);

  const discipline = await db.query.disciplines.findFirst({
    where: eq(disciplines.code, activeCode),
  });

  const rawResults = discipline
    ? await db
        .select({
          shooterId: results.shooterId,
          firstName: shooters.firstName,
          lastName: shooters.lastName,
          nationality: shooters.nationality,
          clubName: clubs.name,
          category: results.category,
          qualTotal: results.qualTotal,
          qualInners: results.qualInners,
          qualRank: results.qualRank,
          competitionId: results.competitionId,
          competitionName: competitions.name,
          competitionDate: competitions.date,
          competitionLevel: competitions.level,
        })
        .from(results)
        .innerJoin(shooters, eq(results.shooterId, shooters.id))
        .leftJoin(clubs, eq(shooters.clubId, clubs.id))
        .innerJoin(competitions, eq(results.competitionId, competitions.id))
        .where(
          and(
            eq(results.disciplineId, discipline.id),
            isNotNull(results.qualTotal),
            inArray(shooters.apparatus, [...MVP_APPARATUS]),
          )
        )
        .orderBy(asc(competitions.date))
    : [];

  const isAP = activeCode.startsWith("AP");

  // ── Category tabs available for this discipline ──────────────────────────
  const categoriesPresent = Array.from(new Set(rawResults.map((r) => r.category))) as AgeCategory[];
  categoriesPresent.sort((a, b) => CATEGORY_RANK[b] - CATEGORY_RANK[a]); // stariji prvo
  const validKategorija = categoriesPresent.find((c) => c === (kategorija as AgeCategory));
  const activeKategorija: AgeCategory | null =
    validKategorija ?? (categoriesPresent.includes("senior") ? "senior" : categoriesPresent[0] ?? null);

  const categoryRows = activeKategorija
    ? rawResults.filter((r) => r.category === activeKategorija)
    : [];

  // Unique NOCs for country filter (within active category)
  const allNocs = Array.from(
    new Set(categoryRows.map((r) => r.nationality).filter(Boolean) as string[])
  ).sort();

  // ── Group by shooter ──────────────────────────────────────────────────────
  type MatchRow = {
    competitionId: number;
    competitionName: string;
    date: string;
    level: CompetitionLevel;
    qualTotal: number;
    qualRank: number | null;
  };
  type ShooterEntry = {
    firstName: string;
    lastName: string;
    nationality: string | null;
    clubName: string | null;
    matches: MatchRow[];
    bestInners: number | null;
  };

  const shooterMap = new Map<number, ShooterEntry>();

  for (const r of categoryRows) {
    if (!shooterMap.has(r.shooterId)) {
      shooterMap.set(r.shooterId, {
        firstName: r.firstName,
        lastName: r.lastName,
        nationality: r.nationality,
        clubName: r.clubName,
        matches: [],
        bestInners: null,
      });
    }
    const entry = shooterMap.get(r.shooterId)!;
    if (r.qualTotal != null) {
      entry.matches.push({
        competitionId: r.competitionId,
        competitionName: r.competitionName,
        date: r.competitionDate,
        level: r.competitionLevel,
        qualTotal: parseFloat(r.qualTotal),
        qualRank: r.qualRank,
      });
    }
    if (r.qualInners != null && (entry.bestInners === null || r.qualInners > entry.bestInners)) {
      entry.bestInners = r.qualInners;
    }
  }

  const seasonWin = seasonWindow(seasonType, seasonYear);
  const prevSeasonWin = seasonWindow(seasonType, seasonYear - 1);
  // Za H2H panel — fiksne karijerne/tekuće-sezonske vrednosti, nezavisne od tabelinog period toggle-a.
  const airSeasonYear = currentSeasonStartYear("vazdusna");

  const allRanked = Array.from(shooterMap.entries()).map(([shooterId, data]) => {
    const entriesSlim = data.matches.map((m) => ({ qualTotal: m.qualTotal, date: m.date, level: m.level }));
    const forma = computeFormaFromEntries(entriesSlim, { code: activeCode });

    // Aktivni period (za tabelu — menja se preko peak/best3/prosek/poslednja-3 toggle-a)
    const windowEntries = filterByPeriod(entriesSlim, activePeriod, seasonYear);
    const peakActive = windowEntries.length > 0 ? Math.max(...windowEntries.map((e) => e.qualTotal)) : null;
    const best3Active = computeAvgOfTopN(windowEntries, 3);
    const recent3Active = computeRecentAvg(windowEntries, 3);
    const avgActive = computeMean(windowEntries);
    const periodCount = windowEntries.length;

    // Karijerne vrednosti (za H2H panel, uvek karijerni Peak/Best-3/Poslednja-3 + tekuća sezona prosek)
    const peakCareer = entriesSlim.length > 0 ? Math.max(...entriesSlim.map((e) => e.qualTotal)) : null;
    const best3Career = computeAvgOfTopN(entriesSlim, 3);
    const recent3Career = computeRecentAvg(entriesSlim, 3);
    const seasonAvgCareer = computeMean(filterByPeriod(entriesSlim, "vazdusna", airSeasonYear));

    const { avg: seasonAvg, count: seasonCount } = computeSeasonAvg(entriesSlim, seasonWin);
    const { avg: prevSeasonAvg } = computeSeasonAvg(entriesSlim, prevSeasonWin);
    const improvement =
      seasonAvg !== null && prevSeasonAvg !== null ? seasonAvg - prevSeasonAvg : null;

    return {
      shooterId,
      ...data,
      forma,
      peakActive,
      best3Active,
      recent3Active,
      avgActive,
      periodCount,
      peakCareer,
      best3Career,
      recent3Career,
      seasonAvgCareer,
      seasonAvg,
      seasonCount,
      improvement,
    };
  });

  const zFiltered = activeZemlja
    ? allRanked.filter((s) => s.nationality === activeZemlja)
    : allRanked;

  let displayed: typeof zFiltered = [];
  switch (activeView) {
    case "forma":
      displayed = zFiltered
        .filter((s) => s.forma.sampleSize >= RANKING_MIN_SAMPLE)
        .sort((a, b) => {
          const fa = a.forma.forma ?? 0;
          const fb = b.forma.forma ?? 0;
          if (fb !== fa) return fb - fa;
          if ((b.peakCareer ?? 0) !== (a.peakCareer ?? 0)) return (b.peakCareer ?? 0) - (a.peakCareer ?? 0);
          return b.forma.sampleSize - a.forma.sampleSize;
        });
      break;
    case "peak":
      displayed = zFiltered.filter((s) => s.peakActive !== null).sort((a, b) => b.peakActive! - a.peakActive!);
      break;
    case "best3":
      displayed = zFiltered.filter((s) => s.best3Active !== null).sort((a, b) => b.best3Active! - a.best3Active!);
      break;
    case "seasonavg":
      displayed = zFiltered.filter((s) => s.avgActive !== null).sort((a, b) => b.avgActive! - a.avgActive!);
      break;
    case "recent3":
      displayed = zFiltered.filter((s) => s.recent3Active !== null).sort((a, b) => b.recent3Active! - a.recent3Active!);
      break;
    case "improved":
      displayed = zFiltered.filter((s) => s.improvement !== null).sort((a, b) => b.improvement! - a.improvement!);
      break;
    case "h2h":
      displayed = zFiltered;
      break;
  }

  const activeTab = TABS.find((tb) => tb.code === activeCode)!;

  // ── URL builder ──────────────────────────────────────────────────────────
  function buildUrl(overrides: Partial<{ disciplina: string; kategorija: string; view: string; zemlja: string; sezona: string; sezonaTip: string }>) {
    const p = new URLSearchParams();
    const merged = {
      disciplina: activeCode.toLowerCase(),
      kategorija: activeKategorija ?? "",
      view: activeView,
      zemlja: activeZemlja ?? "",
      sezona: String(seasonYear),
      sezonaTip: requestedPeriod,
      ...overrides,
    };
    if (merged.disciplina && merged.disciplina !== "arm") p.set("disciplina", merged.disciplina);
    if (merged.kategorija) p.set("kategorija", merged.kategorija);
    if (merged.view && merged.view !== "forma") p.set("view", merged.view);
    if (merged.zemlja) p.set("zemlja", merged.zemlja);
    if (PERIOD_VIEWS.includes(merged.view as ViewKey) || IMPROVED_VIEWS.includes(merged.view as ViewKey)) {
      p.set("sezonaTip", merged.sezonaTip);
      if (merged.sezonaTip !== "karijera") p.set("sezona", merged.sezona);
    }
    const qs = p.toString();
    return qs ? `/rangiranje?${qs}` : "/rangiranje";
  }

  // ── H2H candidate mapping ────────────────────────────────────────────────
  const h2hCandidates: H2HCandidate[] = zFiltered.map((s) => ({
    shooterId: s.shooterId,
    firstName: s.firstName,
    lastName: s.lastName,
    nationality: s.nationality,
    clubName: s.clubName,
    category: activeKategorija ?? "senior",
    forma: s.forma.forma,
    trend: s.forma.forma !== null ? (s.forma.trend as Trend) : null,
    peak: s.peakCareer,
    best3avg: s.best3Career,
    seasonAvg: s.seasonAvgCareer,
    recent3avg: s.recent3Career,
    appearances: s.matches.length,
    matches: s.matches.map((m) => ({
      competitionId: m.competitionId,
      competitionName: m.competitionName,
      date: m.date,
      qualTotal: m.qualTotal,
      qualRank: m.qualRank,
    })),
  }));

  const seasonPeriods = [seasonYear, seasonYear - 1, seasonYear - 2, seasonYear - 3, seasonYear - 4];

  const h2hLabels: H2HLabels = {
    h2hPickPrompt: t("h2hPickPrompt"),
    h2hSwap: t("h2hSwap"),
    h2hPickBoth: t("h2hPickBoth"),
    h2hCommonMeets: t("h2hCommonMeets"),
    h2hNoCommonMeets: t("h2hNoCommonMeets"),
    h2hStat_forma: t("h2hStat_forma"),
    h2hStat_peak: t("h2hStat_peak"),
    h2hStat_best3: t("h2hStat_best3"),
    h2hStat_seasonAvg: t("h2hStat_seasonAvg"),
    h2hStat_recent3: t("h2hStat_recent3"),
    h2hStat_appearances: t("h2hStat_appearances"),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">

      {/* Header */}
      <div className="mb-6">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.025em", lineHeight: 1.05 }}
        >
          {t("title")}
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* Discipline tabs */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {TABS.map(({ code, label, labelEn }) => {
          const active = activeCode === code;
          const displayLabel = locale === "en" ? labelEn : label;
          return (
            <Link
              key={code}
              href={buildUrl({ disciplina: code.toLowerCase(), kategorija: "" })}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors no-underline"
              style={
                active
                  ? { background: "var(--ink)", color: "var(--bg)" }
                  : { background: "var(--surface-2)", color: "var(--muted)" }
              }
            >
              <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold">{code}</span>
              <span className="hidden sm:inline font-normal">{displayLabel}</span>
            </Link>
          );
        })}
      </div>

      {/* Category tabs */}
      {categoriesPresent.length > 1 && (
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {categoriesPresent.map((cat) => {
            const active = activeKategorija === cat;
            return (
              <Link
                key={cat}
                href={buildUrl({ kategorija: cat })}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-[0.7rem] font-semibold transition-colors no-underline"
                style={
                  active
                    ? { background: "var(--brand-primary)", color: "white" }
                    : { background: "transparent", color: "var(--subtle)", border: "1px solid var(--border)" }
                }
              >
                {CATEGORY_LABEL[cat]}
              </Link>
            );
          })}
        </div>
      )}

      {/* View selector */}
      <div className="flex items-center gap-1 mb-4 flex-nowrap overflow-x-auto pb-1 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
        {VIEWS.map(({ key, labelKey }) => {
          const active = activeView === key;
          return (
            <Link
              key={key}
              href={buildUrl({ view: key })}
              className="inline-flex items-center shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors no-underline border"
              style={
                active
                  ? { background: "var(--brand-primary)", color: "white", borderColor: "var(--brand-primary)" }
                  : { background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }
              }
            >
              {t(labelKey)}
            </Link>
          );
        })}
      </div>

      {/* Period control — 3-way (Karijera/Sezona/Kalendarska) for peak/best3/prosek/poslednja-3,
          2-way (Sezona/Kalendarska) za najviše napredovao (treba ograničen prozor za deltu) */}
      {(PERIOD_VIEWS.includes(activeView) || IMPROVED_VIEWS.includes(activeView)) && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
          <div className="flex items-center gap-1">
            {(PERIOD_VIEWS.includes(activeView)
              ? (["karijera", "vazdusna", "kalendarska"] as PeriodType[])
              : (["vazdusna", "kalendarska"] as PeriodType[])
            ).map((pt) => (
              <Link
                key={pt}
                href={buildUrl({
                  sezonaTip: pt,
                  sezona: pt === "karijera" ? String(seasonYear) : String(currentSeasonStartYear(pt)),
                })}
                className="px-2.5 py-1 rounded-md text-[0.7rem] font-semibold transition-colors no-underline"
                style={
                  activePeriod === pt
                    ? { background: "var(--ink)", color: "var(--bg)" }
                    : { background: "var(--surface-2)", color: "var(--muted)" }
                }
              >
                {pt === "karijera" ? t("periodCareer") : pt === "vazdusna" ? t("seasonAir") : t("seasonCalendar")}
              </Link>
            ))}
          </div>
          {activePeriod !== "karijera" && (
            <>
              <span className="text-[var(--border-strong)]" aria-hidden="true">·</span>
              <div className="flex items-center gap-1 flex-wrap">
                {seasonPeriods.map((y) => (
                  <Link
                    key={y}
                    href={buildUrl({ sezona: String(y) })}
                    className="px-2 py-1 rounded-md text-[0.7rem] font-[family-name:var(--font-jetbrains-mono)] font-semibold transition-colors no-underline"
                    style={
                      seasonYear === y
                        ? { background: "var(--brand-primary)", color: "white" }
                        : { background: "var(--surface-2)", color: "var(--muted)" }
                    }
                  >
                    {formatSeasonLabel(seasonType, y)}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Country filter */}
      {activeView !== "h2h" && allNocs.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 mb-5">
          <Link
            href={buildUrl({ zemlja: "" })}
            className="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors no-underline font-[family-name:var(--font-jetbrains-mono)]"
            style={
              !activeZemlja
                ? { background: "var(--ink)", color: "var(--bg)" }
                : { background: "var(--surface-2)", color: "var(--muted)" }
            }
          >
            {tCommon("all")}
          </Link>
          {allNocs.map((noc) => {
            const a2 = nocAlpha2(noc);
            const active = activeZemlja === noc;
            return (
              <Link
                key={noc}
                href={buildUrl({ zemlja: noc })}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors no-underline font-[family-name:var(--font-jetbrains-mono)]"
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
              </Link>
            );
          })}
          <span className="text-xs text-[var(--subtle)] ml-1 font-[family-name:var(--font-jetbrains-mono)] tabular-nums">
            {displayed.length}
          </span>
        </div>
      )}

      {/* ── H2H view ─────────────────────────────────────────────────────── */}
      {activeView === "h2h" ? (
        <HeadToHeadPanel
          candidates={h2hCandidates}
          labels={h2hLabels}
          seasonLabel={formatSeasonLabel("vazdusna", airSeasonYear)}
        />
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] py-20 text-center">
          <p className="text-sm text-[var(--muted)]">
            {t("noData")}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <th className={`${TH} text-right w-12`}>#</th>
                <th className={`${TH} text-left`}>{t("shooter")}</th>
                <th className={`${TH} text-left hidden md:table-cell`}>{t("country")}</th>
                <th className={`${TH} text-left hidden lg:table-cell`}>{t("club")}</th>
                <th className={`${TH} text-right`}>
                  {activeView === "improved" ? t("improvedCol") : t(VIEWS.find((v) => v.key === activeView)!.labelKey)}
                </th>
                <th className={`${TH} text-right hidden sm:table-cell`}>
                  {activeView === "forma" ? t("peak") : t("inSeason")}
                </th>
                {isAP && (
                  <th className={`${TH} text-right hidden sm:table-cell`}>{t("inners")}</th>
                )}
                <th className={`${TH} text-right hidden md:table-cell`}>{t("appearances")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {displayed.map((s, i) => {
                const rank = i + 1;
                const isFirst = rank === 1;
                const isTop3 = rank <= 3;

                return (
                  <tr
                    key={s.shooterId}
                    className="group hover:bg-[var(--surface)] transition-colors"
                  >
                    {/* Rank */}
                    <td className="w-12 px-4 py-3 text-right">
                      <span
                        className="font-[family-name:var(--font-barlow-condensed)] font-extrabold tabular-nums leading-none"
                        style={{
                          fontSize: isFirst ? "1.2rem" : isTop3 ? "1rem" : "0.875rem",
                          color: isFirst
                            ? "var(--brand-primary)"
                            : isTop3
                            ? "var(--ink)"
                            : "var(--subtle)",
                        }}
                      >
                        {rank}
                      </span>
                    </td>

                    {/* Strelac */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/strelci/${s.shooterId}`}
                        className="font-semibold text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors"
                      >
                        {s.lastName} {s.firstName}
                      </Link>
                      {/* Zemlja on mobile */}
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

                    {/* Primary metric — depends on active view */}
                    <td className="px-4 py-3 text-right">
                      {activeView === "forma" && (
                        s.forma.forma !== null ? (
                          <span className="inline-flex items-center justify-end gap-1.5">
                            <span
                              className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]"
                              style={{ fontSize: isTop3 ? "1rem" : "0.875rem" }}
                            >
                              {s.forma.forma.toFixed(1)}
                            </span>
                            <span
                              className="font-bold text-xs font-[family-name:var(--font-jetbrains-mono)]"
                              style={{ color: trendColor(s.forma.trend) }}
                            >
                              {trendLabel(s.forma.trend)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--subtle)]">—</span>
                        )
                      )}
                      {activeView === "peak" && (
                        <span
                          className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]"
                          style={{ fontSize: isTop3 ? "1rem" : "0.875rem" }}
                        >
                          {s.peakActive!.toFixed(1)}
                        </span>
                      )}
                      {activeView === "best3" && (
                        <span
                          className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]"
                          style={{ fontSize: isTop3 ? "1rem" : "0.875rem" }}
                        >
                          {s.best3Active!.toFixed(1)}
                        </span>
                      )}
                      {activeView === "seasonavg" && (
                        <span
                          className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]"
                          style={{ fontSize: isTop3 ? "1rem" : "0.875rem" }}
                        >
                          {s.avgActive!.toFixed(1)}
                        </span>
                      )}
                      {activeView === "recent3" && (
                        <span
                          className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]"
                          style={{ fontSize: isTop3 ? "1rem" : "0.875rem" }}
                        >
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
                        {s.bestInners != null ? (
                          `${s.bestInners}×`
                        ) : (
                          <span className="text-[var(--subtle)]">—</span>
                        )}
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

          {/* Footer count */}
          <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)]">
              {t("shootersCount", { count: displayed.length })} · {locale === "en" ? activeTab.labelEn : activeTab.label}
              {activeKategorija ? ` · ${CATEGORY_LABEL[activeKategorija]}` : ""}
              {activeZemlja ? ` · ${activeZemlja}` : ""}
            </span>
            <span className="text-xs text-[var(--subtle)]">
              {t("footerSubtitle")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
