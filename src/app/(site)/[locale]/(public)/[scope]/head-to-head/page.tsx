export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { shooters, clubs, results, disciplines, competitions, shooterFormaCache } from "@/lib/db/schema";
import { eq, isNotNull, and, inArray, asc } from "drizzle-orm";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { buildAlternates } from "@/i18n/alternates";
import { buildShooterScopeFilter, type Scope } from "@/lib/scope";
import { MVP_APPARATUS } from "@/lib/mvp-scope";
import { ScopedLink } from "../../components/ScopedLink";
import { HeadToHeadPanel, type H2HCandidate, type H2HLabels } from "../rangiranje/HeadToHeadPanel";
import { type Trend } from "@/lib/forma";
import { type AgeCategory, CATEGORY_RANK } from "@/lib/pdf-import/types";
import { currentSeasonStartYear, seasonLabel as formatSeasonLabel } from "@/lib/ranking-metrics";

type DiscCode = "ARM" | "ARW" | "APM" | "APW";

const TABS: { code: DiscCode; label: string; labelEn: string }[] = [
  { code: "ARM", label: "10m puška M",   labelEn: "10m Air Rifle Men" },
  { code: "ARW", label: "10m puška Ž",   labelEn: "10m Air Rifle Women" },
  { code: "APM", label: "10m pištolj M", labelEn: "10m Air Pistol Men" },
  { code: "APW", label: "10m pištolj Ž", labelEn: "10m Air Pistol Women" },
];

type Props = {
  params: Promise<{ scope: Scope }>;
  searchParams: Promise<{ disc?: string; a?: string; b?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { scope } = await params;
  const [t, locale] = await Promise.all([getTranslations("ranking"), getLocale()]);
  return {
    title: t("viewH2H") + " — Shootermarkt",
    alternates: buildAlternates(locale, scope, "/head-to-head"),
  };
}

export default async function HeadToHeadPage({ params, searchParams }: Props) {
  const { scope } = await params;
  const { disc, a, b } = await searchParams;
  const locale = await getLocale();
  const t = await getTranslations("ranking");

  const validCode = TABS.find((tab) => tab.code === disc?.toUpperCase())?.code;
  const activeCode: DiscCode = validCode ?? "ARM";

  const initialP1 = a ? parseInt(a) : undefined;
  const initialP2 = b ? parseInt(b) : undefined;

  const scopeFilter = buildShooterScopeFilter(scope);

  const discipline = await db.query.disciplines.findFirst({
    where: eq(disciplines.code, activeCode),
  });

  const [rawResults, cacheRows] = discipline
    ? await Promise.all([
        db
          .select({
            shooterId:       results.shooterId,
            firstName:       shooters.firstName,
            lastName:        shooters.lastName,
            nationality:     shooters.nationality,
            clubName:        clubs.name,
            category:        results.category,
            qualTotal:       results.qualTotal,
            qualRank:        results.qualRank,
            competitionId:   results.competitionId,
            competitionName: competitions.name,
            competitionDate: competitions.date,
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
              scopeFilter,
            )
          )
          .orderBy(asc(competitions.date)),

        db
          .select({
            shooterId:    shooterFormaCache.shooterId,
            forma:        shooterFormaCache.forma,
            trend:        shooterFormaCache.trend,
            peakCareer:   shooterFormaCache.peakCareer,
            best3Career:  shooterFormaCache.best3Career,
            seasonAvg:    shooterFormaCache.seasonAvg,
            recent3Career: shooterFormaCache.recent3Career,
            careerCount:  shooterFormaCache.careerCount,
          })
          .from(shooterFormaCache)
          .where(eq(shooterFormaCache.disciplineCode, activeCode)),
      ])
    : [[], []];

  // Group results by shooterId — pick highest-rank category per shooter
  type Entry = {
    shooterId: number;
    firstName: string;
    lastName: string;
    nationality: string | null;
    clubName: string | null;
    category: AgeCategory;
    matches: Array<{ competitionId: number; competitionName: string; date: string; qualTotal: number; qualRank: number | null }>;
  };

  const shooterMap = new Map<number, Entry>();
  for (const r of rawResults) {
    const cat = r.category as AgeCategory;
    if (!shooterMap.has(r.shooterId)) {
      shooterMap.set(r.shooterId, {
        shooterId: r.shooterId,
        firstName: r.firstName,
        lastName: r.lastName,
        nationality: r.nationality,
        clubName: r.clubName,
        category: cat,
        matches: [],
      });
    }
    const entry = shooterMap.get(r.shooterId)!;
    // Keep the highest-rank (most senior) category seen
    if (CATEGORY_RANK[cat] > CATEGORY_RANK[entry.category]) {
      entry.category = cat;
    }
    if (r.qualTotal != null) {
      entry.matches.push({
        competitionId:   r.competitionId,
        competitionName: r.competitionName,
        date:            r.competitionDate,
        qualTotal:       parseFloat(r.qualTotal),
        qualRank:        r.qualRank,
      });
    }
  }

  const cacheByShooter = new Map(cacheRows.map((r) => [r.shooterId, r]));

  const candidates: H2HCandidate[] = Array.from(shooterMap.values()).map((entry) => {
    const cache = cacheByShooter.get(entry.shooterId);
    return {
      shooterId:   entry.shooterId,
      firstName:   entry.firstName,
      lastName:    entry.lastName,
      nationality: entry.nationality,
      clubName:    entry.clubName,
      category:    entry.category,
      forma:       cache?.forma       != null ? Number(cache.forma)       : null,
      trend:       (cache?.trend ?? null) as Trend | null,
      peak:        cache?.peakCareer  != null ? Number(cache.peakCareer)  : null,
      best3avg:    cache?.best3Career != null ? Number(cache.best3Career) : null,
      seasonAvg:   cache?.seasonAvg   != null ? Number(cache.seasonAvg)   : null,
      recent3avg:  cache?.recent3Career != null ? Number(cache.recent3Career) : null,
      appearances: cache?.careerCount ?? entry.matches.length,
      matches:     entry.matches,
    };
  });

  // Sort by forma desc so search dropdown feels ranked
  candidates.sort((a, b) => (b.forma ?? -Infinity) - (a.forma ?? -Infinity));

  const airSeasonYear = currentSeasonStartYear("vazdusna");
  const seasonLbl = formatSeasonLabel("vazdusna", airSeasonYear);

  const h2hLabels: H2HLabels = {
    h2hPickPrompt:        t("h2hPickPrompt"),
    h2hSwap:              t("h2hSwap"),
    h2hPickBoth:          t("h2hPickBoth"),
    h2hCommonMeets:       t("h2hCommonMeets"),
    h2hNoCommonMeets:     t("h2hNoCommonMeets"),
    h2hStat_forma:        t("h2hStat_forma"),
    h2hStat_peak:         t("h2hStat_peak"),
    h2hStat_best3:        t("h2hStat_best3"),
    h2hStat_seasonAvg:    t("h2hStat_seasonAvg"),
    h2hStat_recent3:      t("h2hStat_recent3"),
    h2hStat_appearances:  t("h2hStat_appearances"),
  };

  const h2hTitle = locale === "en" ? "Head-to-head" : "Head-to-head";
  const h2hSubtitle = locale === "en"
    ? "Compare two shooters across all their shared competitions"
    : "Uporedi dva strelca na zajedničkim takmičenjima";

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">

      {/* Header */}
      <div className="mb-6">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.025em", lineHeight: 1.05 }}
        >
          {h2hTitle}
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">{h2hSubtitle}</p>
      </div>

      {/* Discipline tabs */}
      <div className="flex items-center gap-1 mb-6 flex-wrap">
        {TABS.map(({ code, label, labelEn }) => {
          const active = activeCode === code;
          const displayLabel = locale === "en" ? labelEn : label;
          return (
            <ScopedLink
              key={code}
              href={`/head-to-head?disc=${code.toLowerCase()}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors no-underline"
              style={
                active
                  ? { background: "var(--ink)", color: "var(--bg)" }
                  : { background: "var(--surface-2)", color: "var(--muted)" }
              }
            >
              <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold">{code}</span>
              <span className="hidden sm:inline font-normal">{displayLabel}</span>
            </ScopedLink>
          );
        })}
      </div>

      {/* H2H Panel */}
      {candidates.length < 2 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-20 text-center">
          <p className="text-sm text-[var(--muted)]">
            {locale === "en"
              ? "Not enough shooters with results in this discipline."
              : "Nema dovoljno strelaca sa rezultatima u ovoj disciplini."}
          </p>
        </div>
      ) : (
        <HeadToHeadPanel
          candidates={candidates}
          labels={h2hLabels}
          seasonLabel={seasonLbl}
          initialP1={initialP1}
          initialP2={initialP2}
        />
      )}

      {/* Back to rankings */}
      <div className="mt-8 pt-6 border-t border-[var(--border)]">
        <ScopedLink
          href={`/rangiranje?disciplina=${activeCode.toLowerCase()}`}
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        >
          ← {locale === "en" ? "Back to rankings" : "Nazad na rangiranje"}
        </ScopedLink>
      </div>
    </div>
  );
}
