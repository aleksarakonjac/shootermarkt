export const revalidate = 300;

import { db } from "@shootermarkt/db";
import { shooters, clubs, results, disciplines, competitions, shooterFormaCache } from "@shootermarkt/db/schema";
import { eq, isNotNull, and, inArray, asc } from "drizzle-orm";
import { MVP_APPARATUS } from "@/lib/mvp-scope";
import { ScopedLink } from "../../components/ScopedLink";
import type { Metadata } from "next";
import { type CompetitionLevel, type Trend } from "@/lib/forma";
import { type AgeCategory, CATEGORY_RANK } from "@shootermarkt/db/pdf-import-types";
import { getLocale, getTranslations } from "next-intl/server";
import { buildAlternates } from "@/i18n/alternates";
import { type Scope } from "@/lib/scope";
import { rankedFormaCacheFilter } from "@/lib/forma-query";
import { RangiranjeClient, type RangiranjeShooter, type RangiranjeLabels } from "./RangiranjeClient";

export async function generateMetadata({ params }: { params: Promise<{ scope: Scope }> }): Promise<Metadata> {
  const { scope } = await params;
  const [t, locale] = await Promise.all([getTranslations("ranking"), getLocale()]);
  return {
    title: t("title"),
    alternates: buildAlternates(locale, scope, "/rangiranje"),
  };
}

type DiscCode = "ARM" | "ARW" | "APM" | "APW";

const TABS: { code: DiscCode; label: string; labelEn: string }[] = [
  { code: "ARM", label: "10m puška M",    labelEn: "10m Air Rifle Men" },
  { code: "ARW", label: "10m puška Ž",    labelEn: "10m Air Rifle Women" },
  { code: "APM", label: "10m pištolj M",  labelEn: "10m Air Pistol Men" },
  { code: "APW", label: "10m pištolj Ž",  labelEn: "10m Air Pistol Women" },
];

type Props = {
  params: Promise<{ scope: Scope }>;
  searchParams: Promise<{ disciplina?: string }>;
};

export default async function RangiranjeePage({ params, searchParams }: Props) {
  const { scope } = await params;
  const locale = await getLocale();
  const [t, tCommon] = await Promise.all([
    getTranslations("ranking"),
    getTranslations("common"),
  ]);

  const { disciplina } = await searchParams;
  const validCode = TABS.find((tab) => tab.code === disciplina?.toUpperCase())?.code;
  const activeCode: DiscCode = validCode ?? "ARM";
  const isAP = activeCode.startsWith("AP");

  const discipline = await db.query.disciplines.findFirst({
    where: eq(disciplines.code, activeCode),
  });

  const rawResults = discipline
    ? await db
        .select({
          shooterId:       results.shooterId,
          firstName:       shooters.firstName,
          lastName:        shooters.lastName,
          nationality:     shooters.nationality,
          clubName:        clubs.name,
          category:        results.category,
          qualTotal:       results.qualTotal,
          qualInners:      results.qualInners,
          qualRank:        results.qualRank,
          competitionId:   results.competitionId,
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

  // Group by (shooterId, category) — same shooter can appear in both senior + junior
  type MatchRow = {
    competitionId: number;
    competitionName: string;
    date: string;
    level: CompetitionLevel;
    qualTotal: number;
    qualRank: number | null;
  };
  type ShooterEntry = {
    shooterId: number;
    firstName: string;
    lastName: string;
    nationality: string | null;
    clubName: string | null;
    category: AgeCategory;
    bestInners: number | null;
    matches: MatchRow[];
  };

  const shooterMap = new Map<string, ShooterEntry>();

  for (const r of rawResults) {
    const key = `${r.shooterId}:${r.category}`;
    if (!shooterMap.has(key)) {
      shooterMap.set(key, {
        shooterId: r.shooterId,
        firstName: r.firstName,
        lastName: r.lastName,
        nationality: r.nationality,
        clubName: r.clubName,
        category: r.category as AgeCategory,
        bestInners: null,
        matches: [],
      });
    }
    const entry = shooterMap.get(key)!;
    if (r.qualTotal != null) {
      entry.matches.push({
        competitionId:   r.competitionId,
        competitionName: r.competitionName,
        date:            r.competitionDate,
        level:           r.competitionLevel as CompetitionLevel,
        qualTotal:       parseFloat(r.qualTotal),
        qualRank:        r.qualRank,
      });
    }
    if (r.qualInners != null && (entry.bestInners === null || r.qualInners > entry.bestInners)) {
      entry.bestInners = r.qualInners;
    }
  }

  // Load forma cache for all involved shooters
  const uniqueShooterIds = Array.from(new Set(rawResults.map((r) => r.shooterId)));
  const cacheRows = uniqueShooterIds.length > 0
    ? await db
        .select({
          shooterId:     shooterFormaCache.shooterId,
          forma:         shooterFormaCache.forma,
          trend:         shooterFormaCache.trend,
          sampleSize:    shooterFormaCache.sampleSize,
          peakCareer:    shooterFormaCache.peakCareer,
          best3Career:   shooterFormaCache.best3Career,
          recent3Career: shooterFormaCache.recent3Career,
          seasonAvg:     shooterFormaCache.seasonAvg,
          careerCount:   shooterFormaCache.careerCount,
        })
        .from(shooterFormaCache)
        .where(
          and(
            inArray(shooterFormaCache.shooterId, uniqueShooterIds),
            eq(shooterFormaCache.disciplineCode, activeCode),
            rankedFormaCacheFilter(),
          )
        )
    : [];

  const cacheByShooter = new Map(cacheRows.map((r) => [r.shooterId, r]));

  const shooterData: RangiranjeShooter[] = Array.from(shooterMap.values()).map((entry) => {
    const cache = cacheByShooter.get(entry.shooterId);
    return {
      ...entry,
      forma:         cache?.forma        != null ? Number(cache.forma)        : null,
      formaTrend:    (cache?.trend ?? "stable") as Trend,
      formaSampleSize: cache?.sampleSize ?? 0,
      peakCareer:    cache?.peakCareer   != null ? Number(cache.peakCareer)   : null,
      best3Career:   cache?.best3Career  != null ? Number(cache.best3Career)  : null,
      recent3Career: cache?.recent3Career != null ? Number(cache.recent3Career) : null,
      seasonAvgCache: cache?.seasonAvg   != null ? Number(cache.seasonAvg)   : null,
      careerCount:   cache?.careerCount  ?? entry.matches.length,
    };
  });

  const categoriesPresent = Array.from(new Set(rawResults.map((r) => r.category))) as AgeCategory[];
  categoriesPresent.sort((a, b) => CATEGORY_RANK[b] - CATEGORY_RANK[a]);

  const activeTabLabel = locale === "en"
    ? TABS.find((t) => t.code === activeCode)!.labelEn
    : TABS.find((t) => t.code === activeCode)!.label;

  const labels: RangiranjeLabels = {
    title:            t("title"),
    subtitle:         t("subtitle"),
    noData:           t("noData"),
    shooter:          t("shooter"),
    country:          t("country"),
    club:             t("club"),
    peak:             t("peak"),
    inSeason:         t("inSeason"),
    inners:           t("inners"),
    appearances:      t("appearances"),
    improvedCol:      t("improvedCol"),
    footerSubtitle:   t("footerSubtitle"),
    periodCareer:     t("periodCareer"),
    seasonAir:        t("seasonAir"),
    seasonCalendar:   t("seasonCalendar"),
    viewForma:        t("viewForma"),
    viewPeak:         t("viewPeak"),
    viewBest3:        t("viewBest3"),
    viewSeasonAvg:    t("viewSeasonAvg"),
    viewRecent3:      t("viewRecent3"),
    viewImproved:     t("viewImproved"),
    activeTabLabel,
    categoryLabels:   {},
    all:              tCommon("all"),
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

      {/* Discipline tabs — server links, changing discipline refetches data */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {TABS.map(({ code, label, labelEn }) => {
          const active = activeCode === code;
          const displayLabel = locale === "en" ? labelEn : label;
          return (
            <ScopedLink
              key={code}
              href={`/rangiranje?disciplina=${code.toLowerCase()}`}
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

      {/* Client component handles all interactive state */}
      <RangiranjeClient
        activeCode={activeCode}
        isAP={isAP}
        shooters={shooterData}
        categoriesPresent={categoriesPresent}
        labels={labels}
        locale={locale}
      />
    </div>
  );
}
