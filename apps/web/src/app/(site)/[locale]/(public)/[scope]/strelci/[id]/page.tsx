export const revalidate = 300;

import { db } from "@shootermarkt/db";
import { shooters, results, competitions, countries, disciplines, shooterFormaCache } from "@shootermarkt/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ScopedLink } from "../../../components/ScopedLink";
import { ResultsHistoryTable } from "@/components/result-display/ResultsHistoryTable";
import { FormaChart } from "@/components/shooter/FormaChart";
import type { ChartPoint, FormaScore } from "@/components/shooter/FormaChart";
import { FormaScoreHeading } from "@/components/shooter/FormaScoreHeading";
import { CareerStats, type CareerStat } from "@/components/shooter/CareerStats";
import { CATEGORY_LABEL, computeAgeCategoryFromBirthYear } from "@shootermarkt/db/pdf-import-types";
import { NOC_LIST, displayNoc } from "@shootermarkt/db/noc-list";
import { getLocale, getTranslations } from "next-intl/server";
import { buildAlternates } from "@/i18n/alternates";
import type { Scope } from "@/lib/scope";
import { RelatedNewsSection } from "@/components/RelatedNewsSection";
import { ArrowRight } from "lucide-react";
import { ShooterAvatarLightbox } from "@/components/shooter/ShooterAvatarLightbox";

type Props = { params: Promise<{ id: string; scope: Scope }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, scope } = await params;
  const [shooter, locale] = await Promise.all([
    db.query.shooters.findFirst({ where: eq(shooters.id, parseInt(id)) }),
    getLocale(),
  ]);
  const alternates = buildAlternates(locale, scope, `/strelci/${id}`);
  if (!shooter) {
    const t = await getTranslations("shooters.profile");
    return { title: t("notFound"), alternates };
  }
  return { title: `${shooter.lastName} ${shooter.firstName} — Shootermarkt`, alternates };
}

export default async function ShooterPage({ params }: Props) {
  const locale = await getLocale();
  const t = await getTranslations("shooters");
  const tProfile = await getTranslations("shooters.profile");

  const { id } = await params;
  const shooterId = parseInt(id);
  if (isNaN(shooterId)) notFound();

  const shooter = await db.query.shooters.findFirst({
    where: eq(shooters.id, shooterId),
    with: { club: true },
  });
  if (!shooter) notFound();

  const [shooterResults, cacheRows] = await Promise.all([
    db
      .select({
        id: results.id,
        category: results.category,
        qualTotal: results.qualTotal,
        qualRank: results.qualRank,
        qualInners: results.qualInners,
        qualified: results.qualified,
        elimTotal: results.elimTotal,
        elimRank: results.elimRank,
        elimRound: results.elimRound,
        elimDetail: results.elimDetail,
        finalTotal: results.finalTotal,
        finalRank: results.finalRank,
        qualDetail: results.qualDetail,
        finalDetail: results.finalDetail,
        competitionId: competitions.id,
        competitionName: competitions.name,
        competitionDate: competitions.date,
        competitionDateEnd: competitions.dateEnd,
        competitionLocation: competitions.location,
        competitionCountry: countries.name,
        competitionCountryCode2: countries.code2,
        competitionLevel: competitions.level,
        disciplineCode: disciplines.code,
        disciplineId: disciplines.id,
        maxQualScore: disciplines.maxQualScore,
      })
      .from(results)
      .innerJoin(competitions, eq(results.competitionId, competitions.id))
      .leftJoin(countries, eq(competitions.countryId, countries.id))
      .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .where(eq(results.shooterId, shooterId))
      .orderBy(asc(competitions.date)),
    db
      .select({
        disciplineCode: shooterFormaCache.disciplineCode,
        forma:          shooterFormaCache.forma,
        trend:          shooterFormaCache.trend,
        level:          shooterFormaCache.level,
        reliability:    shooterFormaCache.reliability,
        peakProximity:  shooterFormaCache.peakProximity,
        consistency:    shooterFormaCache.consistency,
        momentum:       shooterFormaCache.momentum,
        sampleSize:     shooterFormaCache.sampleSize,
        lowConfidence:  shooterFormaCache.lowConfidence,
        peakCareer:     shooterFormaCache.peakCareer,
        best3Career:    shooterFormaCache.best3Career,
        recent3Career:  shooterFormaCache.recent3Career,
        seasonAvg:      shooterFormaCache.seasonAvg,
        prevSeasonAvg:  shooterFormaCache.prevSeasonAvg,
        improvement:    shooterFormaCache.improvement,
        seasonCount:    shooterFormaCache.seasonCount,
        careerCount:    shooterFormaCache.careerCount,
      })
      .from(shooterFormaCache)
      .where(eq(shooterFormaCache.shooterId, shooterId)),
  ]);

  const initials = `${shooter.firstName[0]}${shooter.lastName[0]}`;

  // ── Quick stats ──────────────────────────────────────────────────────────────
  const totalAppearances = shooterResults.length;
  const finalesCount = shooterResults.filter((r) => r.finalRank != null).length;

  const peakResult = shooterResults
    .filter((r) => r.qualTotal != null)
    .reduce<{ score: number; code: string } | null>((best, r) => {
      const s = parseFloat(r.qualTotal!);
      return !best || s > best.score ? { score: s, code: r.disciplineCode } : best;
    }, null);

  const activeSince = shooterResults.length > 0
    ? new Date(shooterResults[0].competitionDate).getFullYear()
    : null;
  const recentCompetitionIds = new Set(
    [...shooterResults].reverse().map((result) => result.competitionId).filter((id, index, ids) => ids.indexOf(id) === index).slice(0, 5),
  );
  const recentResults = shooterResults.filter((result) => recentCompetitionIds.has(result.competitionId));

  // Trenutna uzrasna kategorija — uvek iz godine rođenja (ISSF standard), nezavisno
  // od kategorije zabeleženih rezultata (koja je istorijska, po konkretnom takmičenju).
  const birthYear = shooter.birthDate
    ? new Date(shooter.birthDate).getFullYear()
    : shooter.birthYear;
  const currentCategory = birthYear ? computeAgeCategoryFromBirthYear(birthYear) : null;

  // ── Chart data ───────────────────────────────────────────────────────────────
  const chartPoints: ChartPoint[] = shooterResults
    .filter((r) => r.qualTotal != null)
    .map((r) => ({
      date: r.competitionDate,
      score: parseFloat(r.qualTotal!),
      discipline: r.disciplineCode,
      competitionId: r.competitionId,
      competitionName: r.competitionName,
      level: r.competitionLevel,
      category: r.category,
    }));

  // Build discipline list from join data — avoids a separate query and uses correct DB values
  const chartDisciplines = (() => {
    const seen = new Map<string, number>();
    for (const r of shooterResults) {
      if (r.qualTotal != null && !seen.has(r.disciplineCode)) {
        seen.set(r.disciplineCode, parseFloat(r.maxQualScore));
      }
    }
    return Array.from(seen.entries()).map(([code, maxScore]) => ({ code, maxScore }));
  })();

  // ── Forma scores per discipline — from pre-computed cache ────────────────────
  const formaScores: Record<string, FormaScore | null> = Object.fromEntries(
    cacheRows.map((r) => {
      if (r.forma == null || r.level == null) return [r.disciplineCode, null];
      return [r.disciplineCode, {
        score:         Number(r.forma),
        trend:         r.trend ?? undefined,
        level:         Number(r.level),
        reliability:   r.reliability   != null ? Number(r.reliability)   : undefined,
        peakProximity: r.peakProximity != null ? Number(r.peakProximity) : undefined,
        consistency:   r.consistency   != null ? Number(r.consistency)   : undefined,
        momentum:      r.momentum      != null ? Number(r.momentum)      : undefined,
        sampleSize:    r.sampleSize,
        lowConfidence: r.lowConfidence,
      } as FormaScore];
    })
  );

  const showChart = chartPoints.length >= 2;

  // ── Career stats per discipline — from cache ──────────────────────────────────
  const DISC_NAMES: Record<string, { sr: string; en: string }> = {
    ARM:  { sr: "10m vazdušna puška · M",         en: "10m Air Rifle · Men" },
    ARW:  { sr: "10m vazdušna puška · Ž",         en: "10m Air Rifle · Women" },
    APM:  { sr: "10m vazdušni pištolj · M",        en: "10m Air Pistol · Men" },
    APW:  { sr: "10m vazdušni pištolj · Ž",        en: "10m Air Pistol · Women" },
    ARMT: { sr: "10m vazdušna puška · Mešoviti tim", en: "10m Air Rifle · Mixed Team" },
    APMT: { sr: "10m vazdušni pištolj · Mešoviti tim", en: "10m Air Pistol · Mixed Team" },
  };

  const cacheByCode = new Map(cacheRows.map((r) => [r.disciplineCode, r]));
  // Keep only disciplines that actually have results, in the same order
  const careerStats: CareerStat[] = chartDisciplines.flatMap(({ code }) => {
    const cache = cacheByCode.get(code);
    if (!cache) return [];
    return [{
      code,
      name: DISC_NAMES[code]?.[locale as "sr" | "en"] ?? DISC_NAMES[code]?.sr ?? code,
      careerCount: cache.careerCount,
      forma: cache.forma != null ? Number(cache.forma) : null,
      peak: cache.peakCareer != null ? Number(cache.peakCareer) : null,
      best3: cache.best3Career != null ? Number(cache.best3Career) : null,
      recent3: cache.recent3Career != null ? Number(cache.recent3Career) : null,
      season: cache.seasonAvg != null ? Number(cache.seasonAvg) : null,
      seasonCount: cache.seasonCount,
      improvement: cache.improvement != null ? Number(cache.improvement) : null,
      trend: cache.trend as CareerStat["trend"],
    }];
  });

  // ── Country info ─────────────────────────────────────────────────────────────
  const displayedNoc = displayNoc(shooter.nationality);
  const nocEntry = displayedNoc
    ? NOC_LIST.find((n) => n.noc === displayedNoc)
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[var(--muted)] mb-8">
        <ScopedLink href="/strelci" className="hover:text-[var(--ink)] transition-colors">
          {t("title")}
        </ScopedLink>
        <span className="text-[var(--subtle)]">/</span>
        <span className="text-[var(--ink)] font-medium">
          {shooter.lastName} {shooter.firstName}
        </span>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4 sm:gap-6 mb-5 pb-5 border-b border-[var(--border)]">
        {/* Avatar */}
        <div
          className="shrink-0"
        >
          {shooter.avatarUrl ? (
            <ShooterAvatarLightbox
              src={shooter.avatarUrl}
              alt={`${shooter.firstName} ${shooter.lastName}`}
            />
          ) : (
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center font-[family-name:var(--font-barlow-condensed)] font-extrabold text-3xl text-white ring-1 ring-[var(--border)]"
              style={{ background: "var(--brand-primary)" }}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Identity + stats */}
        <div className="flex-1 min-w-0 pt-1 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1
              className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)] leading-none mb-3 break-words"
              style={{ fontSize: "clamp(1.75rem, 5vw, 2.75rem)", letterSpacing: "-0.02em" }}
            >
              {shooter.lastName}{" "}
              <span className="font-medium">{shooter.firstName}</span>
            </h1>

            {/* Compact meta */}
            <dl className="mt-2 flex max-w-full flex-wrap items-baseline gap-x-3 gap-y-1">
              {nocEntry && (
                <div className="flex min-w-0 items-center gap-1 text-sm">
                  <dt className="sr-only">{tProfile("nationality")}</dt>
                  <dd>
                    <ScopedLink
                      href={`/strelci?zemlja=${encodeURIComponent(shooter.nationality!)}`}
                      className="flex items-center gap-1 text-[var(--ink)] transition-colors hover:text-[var(--brand-primary)]"
                    >
                    {nocEntry.alpha2 && (
                      <span className={`fi fi-${nocEntry.alpha2.toLowerCase()} shrink-0`} style={{ fontSize: "0.9em", borderRadius: 2 }} aria-hidden="true" />
                    )}
                    {displayedNoc}
                    </ScopedLink>
                  </dd>
                </div>
              )}
              {shooter.apparatus && (
                <div className="flex min-w-0 items-baseline gap-1 text-sm">
                  <dt className="text-[var(--subtle)] shrink-0">{tProfile("discipline")}:</dt>
                  <dd className="min-w-0 text-[var(--ink)]">
                    {shooter.apparatus === "rifle" || shooter.apparatus === "pistol" ? (
                      <ScopedLink
                        href={`/strelci?aparat=${shooter.apparatus}`}
                        className="transition-colors hover:text-[var(--brand-primary)]"
                      >
                        {shooter.apparatus === "rifle" ? t("aparatRifle") : t("aparatPistol")}
                      </ScopedLink>
                    ) : tProfile("bothApparatus")}
                  </dd>
                </div>
              )}
              {(shooter.birthDate || shooter.birthYear) && (
                <div className="flex min-w-0 items-baseline gap-1 text-sm">
                  <dt className="text-[var(--subtle)] shrink-0">{tProfile("birthYear")}:</dt>
                  <dd className="min-w-0 text-[var(--ink)]">
                    {shooter.birthDate
                      ? <><span className="sm:hidden">{new Date(shooter.birthDate).getFullYear()}</span><span className="hidden sm:inline">{`${new Date(shooter.birthDate).getFullYear()} (${shooter.birthDate.split("-").reverse().join(".")})`}</span></>
                      : shooter.birthYear}
                  </dd>
                </div>
              )}
              {currentCategory && (
                <div className="flex min-w-0 items-baseline gap-1 text-sm">
                  <dt className="text-[var(--subtle)] shrink-0">{locale === "en" ? "Category" : "Kategorija"}:</dt>
                  <dd className="min-w-0 text-[var(--ink)]">{CATEGORY_LABEL[currentCategory]}</dd>
                </div>
              )}
              {shooter.club && (
                <div className="flex min-w-0 items-baseline gap-1 text-sm">
                  <dt className="text-[var(--subtle)] shrink-0">{tProfile("club")}:</dt>
                  <dd className="min-w-0 truncate text-[var(--ink)]">{shooter.club.name}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Quick stats 2×2 — right of name */}
          {totalAppearances > 0 && (
            <div className="grid grid-cols-2 gap-px bg-[var(--border)] rounded-lg overflow-hidden border border-[var(--border)] shrink-0 hidden sm:grid">
              <div className="bg-[var(--bg)] px-3 py-2">
                <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--subtle)] font-[family-name:var(--font-barlow-condensed)]">
                  {tProfile("statAppearances")}
                </p>
                <p className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-2xl leading-none tabular-nums text-[var(--ink)] mt-0.5">
                  {totalAppearances}
                </p>
              </div>
              <div className="bg-[var(--bg)] px-3 py-2">
                <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--subtle)] font-[family-name:var(--font-barlow-condensed)]">
                  {tProfile("statFinales")}
                </p>
                <p className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-2xl leading-none tabular-nums text-[var(--ink)] mt-0.5">
                  {finalesCount > 0 ? finalesCount : <span className="text-[var(--subtle)]">—</span>}
                </p>
              </div>
              <div className="bg-[var(--bg)] px-3 py-2">
                <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--subtle)] font-[family-name:var(--font-barlow-condensed)]">
                  {tProfile("statPeak")}
                </p>
                <p className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-2xl leading-none tabular-nums text-[var(--ink)] mt-0.5">
                  {peakResult ? (
                    <>
                      {peakResult.score % 1 !== 0 ? peakResult.score.toFixed(1) : peakResult.score}
                      <span className="ml-1 text-[0.6rem] text-[var(--subtle)]">{peakResult.code}</span>
                    </>
                  ) : "—"}
                </p>
              </div>
              <div className="bg-[var(--bg)] px-3 py-2">
                <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--subtle)] font-[family-name:var(--font-barlow-condensed)]">
                  {tProfile("statActiveSince")}
                </p>
                <p className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-2xl leading-none tabular-nums text-[var(--ink)] mt-0.5">
                  {activeSince ?? "—"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Forma chart ───────────────────────────────────────────────────────── */}
      {showChart && (
        <div className="mb-10">
          <FormaScoreHeading locale={locale} />

          {/* Desktop: one chart per discipline, side by side */}
          <div
            className="hidden sm:grid gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(chartDisciplines.length, 3)}, 1fr)` }}
          >
            {chartDisciplines.map((d) => (
              <FormaChart
                key={d.code}
                points={chartPoints}
                disciplines={[d]}
                formaScores={formaScores}
                locale={locale}
                noDataLabel={tProfile("noChartData")}
              />
            ))}
          </div>

          {/* Mobile: tabbed single chart */}
          <div className="sm:hidden">
            <FormaChart
              points={chartPoints}
              disciplines={chartDisciplines}
              formaScores={formaScores}
              locale={locale}
              noDataLabel={tProfile("noChartData")}
            />
          </div>
        </div>
      )}

      {/* ── Career stats ──────────────────────────────────────────────────────── */}
      {careerStats.length > 0 && (
        <div className="mb-10">
          <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-tight text-[var(--ink)] mb-4">
            {tProfile("statsCareer")}
          </h2>

          <CareerStats stats={careerStats} locale={locale} />
        </div>
      )}

      {/* ── Results history ───────────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-tight text-[var(--ink)]">
            {tProfile("recentResults")}
          </h2>
          {recentResults.length > 0 && <ScopedLink href={`/strelci/${shooterId}/rezultati`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-1 text-sm font-semibold text-[var(--brand-primary)] transition-colors hover:text-[var(--ink)]">{tProfile("viewAllResults")}<ArrowRight size={16} aria-hidden="true" /></ScopedLink>}
        </div>

        {recentResults.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
            <p className="mx-auto text-sm text-[var(--muted)]">{tProfile("noResults")}</p>
          </div>
        ) : (
          <ResultsHistoryTable
            results={recentResults}
            allLabel={tProfile("allDisciplines")}
            locale={locale}
          />
        )}
      </div>

      <RelatedNewsSection type="shooter" refId={shooterId} locale={locale} />
    </div>
  );
}
