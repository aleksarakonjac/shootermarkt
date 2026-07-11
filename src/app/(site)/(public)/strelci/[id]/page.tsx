export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { shooters, results, competitions, disciplines } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ResultsHistoryTable } from "@/components/result-display/ResultsHistoryTable";
import { FormaChart } from "@/components/shooter/FormaChart";
import type { ChartPoint, FormaScore } from "@/components/shooter/FormaChart";
import { FormaScoreHeading } from "@/components/shooter/FormaScoreHeading";
import { computeForma } from "@/lib/forma";
import { CATEGORY_LABEL, computeAgeCategoryFromBirthYear } from "@/lib/pdf-import/types";
import { NOC_LIST } from "@/lib/noc-list";
import { getLocale, getTranslations } from "next-intl/server";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const shooter = await db.query.shooters.findFirst({
    where: eq(shooters.id, parseInt(id)),
  });
  if (!shooter) {
    const t = await getTranslations("shooters.profile");
    return { title: t("notFound") };
  }
  return { title: `${shooter.lastName} ${shooter.firstName} — Shootermarkt` };
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

  const [shooterResults] = await Promise.all([
    db
      .select({
        id: results.id,
        category: results.category,
        qualTotal: results.qualTotal,
        qualRank: results.qualRank,
        qualInners: results.qualInners,
        qualified: results.qualified,
        finalTotal: results.finalTotal,
        finalRank: results.finalRank,
        qualDetail: results.qualDetail,
        finalDetail: results.finalDetail,
        competitionId: competitions.id,
        competitionName: competitions.name,
        competitionDate: competitions.date,
        competitionLevel: competitions.level,
        disciplineCode: disciplines.code,
        disciplineId: disciplines.id,
        apparatus: disciplines.apparatus,
        maxQualScore: disciplines.maxQualScore,
      })
      .from(results)
      .innerJoin(competitions, eq(results.competitionId, competitions.id))
      .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .where(eq(results.shooterId, shooterId))
      .orderBy(asc(competitions.date)),
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

  // ── Forma scores per discipline (for chart header) ───────────────────────────
  const formaScores: Record<string, FormaScore | null> = Object.fromEntries(
    chartDisciplines.map((d) => {
      // chartPoints su hronološki (asc po datumu) — tačan ulaz za computeForma
      const discEntries = chartPoints
        .filter((p) => p.discipline === d.code)
        .map((p) => ({ score: p.score, date: p.date, level: p.level }));
      const f = computeForma(discEntries, { code: d.code });
      if (f.forma === null || f.level === null) return [d.code, null];
      return [d.code, {
        score:         f.forma,
        trend:         f.trend,
        level:         f.level,
        reliability:   f.reliability,
        peakProximity: f.peakProximity,
        consistency:   f.consistency,
        momentum:      f.momentum,
        sampleSize:    f.sampleSize,
        lowConfidence: f.lowConfidence,
      } as FormaScore];
    })
  );

  const showChart = chartPoints.length >= 2;

  // ── Country info ─────────────────────────────────────────────────────────────
  const nocEntry = shooter.nationality
    ? NOC_LIST.find((n) => n.noc === shooter.nationality)
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[var(--muted)] mb-8">
        <Link href="/strelci" className="hover:text-[var(--ink)] transition-colors">
          {t("title")}
        </Link>
        <span className="text-[var(--subtle)]">/</span>
        <span className="text-[var(--ink)] font-medium">
          {shooter.lastName} {shooter.firstName}
        </span>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-6 mb-5 pb-5 border-b border-[var(--border)]">
        {/* Avatar */}
        <div
          className="shrink-0"
        >
          {shooter.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shooter.avatarUrl}
              alt={`${shooter.firstName} ${shooter.lastName}`}
              className="w-24 sm:w-28 rounded-2xl ring-1 ring-[var(--border)] block"
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
              className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)] leading-none mb-3"
              style={{ fontSize: "clamp(1.75rem, 5vw, 2.75rem)", letterSpacing: "-0.02em" }}
            >
              {shooter.lastName}{" "}
              <span className="font-medium">{shooter.firstName}</span>
            </h1>

            {/* Meta — inline key: value */}
            <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 mt-2 w-fit">
              {/* Row 1: Nacionalnost | Godište */}
              {nocEntry && (
                <div className="flex items-center gap-1 text-sm">
                  <dt className="text-[var(--subtle)] shrink-0">{tProfile("nationality")}:</dt>
                  <dd className="text-[var(--ink)] flex items-center gap-1">
                    {nocEntry.alpha2 && (
                      <span className={`fi fi-${nocEntry.alpha2.toLowerCase()} shrink-0`} style={{ fontSize: "0.9em", borderRadius: 2 }} aria-hidden="true" />
                    )}
                    {shooter.nationality}
                  </dd>
                </div>
              )}
              {(shooter.birthDate || shooter.birthYear) && (
                <div className="flex items-baseline gap-1 text-sm">
                  <dt className="text-[var(--subtle)] shrink-0">{tProfile("birthYear")}:</dt>
                  <dd className="text-[var(--ink)]">
                    {shooter.birthDate
                      ? `${new Date(shooter.birthDate).getFullYear()} (${shooter.birthDate.split("-").reverse().join(".")})`
                      : shooter.birthYear}
                  </dd>
                </div>
              )}
              {/* Row 2: Disciplina | Klub */}
              {shooter.apparatus && (
                <div className="flex items-baseline gap-1 text-sm">
                  <dt className="text-[var(--subtle)] shrink-0">{tProfile("discipline")}:</dt>
                  <dd className="text-[var(--ink)]">
                    {shooter.apparatus === "rifle" ? t("aparatRifle") : shooter.apparatus === "pistol" ? t("aparatPistol") : tProfile("bothApparatus")}
                  </dd>
                </div>
              )}
              {shooter.club && (
                <div className="flex items-baseline gap-1 text-sm">
                  <dt className="text-[var(--subtle)] shrink-0">{tProfile("club")}:</dt>
                  <dd className="text-[var(--ink)] truncate">{shooter.club.name}</dd>
                </div>
              )}
              {currentCategory && (
                <div className="flex items-baseline gap-1 text-sm">
                  <dt className="text-[var(--subtle)] shrink-0">{locale === "en" ? "Category" : "Kategorija"}:</dt>
                  <dd className="text-[var(--ink)]">{CATEGORY_LABEL[currentCategory]}</dd>
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

      {/* ── Results history ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-tight text-[var(--ink)] mb-4">
          {tProfile("resultsHistory")}
        </h2>

        {shooterResults.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
            <p className="text-sm text-[var(--muted)]">{tProfile("noResults")}</p>
          </div>
        ) : (
          <ResultsHistoryTable
            results={shooterResults}
            allLabel={tProfile("allDisciplines")}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
}
