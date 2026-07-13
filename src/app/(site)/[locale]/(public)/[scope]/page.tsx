import React, { Suspense } from "react";
import { ScopedLink } from "../components/ScopedLink";
import { db } from "@/lib/db";
import { shooters, clubs, results, disciplines, competitions, countries, shooterFormaCache } from "@/lib/db/schema";
import { eq, desc, asc, and, isNotNull, sql, gte, inArray } from "drizzle-orm";
import { RANKING_MIN_SAMPLE } from "@/lib/forma";
import { TopFormaClient } from "./top-forma-client";
import { QuickH2HClient } from "./quick-h2h-client";
import { Ticker, TickerItem } from "../ticker";
import { CalendarModule } from "../components/CalendarModule";
import { UpcomingEvents } from "../components/UpcomingEvents";
import { NewsSection } from "../components/NewsSection";
import { getLocale, getTranslations } from "next-intl/server";
import { buildAlternates } from "@/i18n/alternates";
import {
  buildCompetitionScopeFilter,
  buildShooterScopeFilter,
  type Scope,
} from "@/lib/scope";
import "./homepage.css";

export async function generateMetadata({ params }: { params: Promise<{ scope: Scope }> }) {
  const { scope } = await params;
  const [t, locale] = await Promise.all([getTranslations("home.metadata"), getLocale()]);
  return {
    title: t("title"),
    description: t("description"),
    alternates: buildAlternates(locale, scope, "/"),
  };
}

// PPR: static shell (layout + suspense skeleton) pre-rendered at build time.
// DB queries run inside HomepageContent (Suspense boundary) on first request.
export const experimental_ppr = true;

interface ShooterFormRow {
  shooterId: number;
  firstName: string;
  lastName: string;
  clubName: string | null;
  nationality: string | null;
  formaScore: number;
  trend: "up" | "down" | "stable";
  peak: number | null;
  entriesCount: number;
  recentScores: number[];
}

const DISC_CODES = ["ARM", "ARW", "APM", "APW"] as const;

export default async function HomePage({ params }: { params: Promise<{ scope: Scope }> }) {
  const { scope } = await params;
  return (
    <Suspense fallback={<HomepageSkeleton />}>
      <HomepageContent scope={scope} />
    </Suspense>
  );
}

function HomepageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      <div className="h-10 bg-[var(--surface)] rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-8">
          <div className="h-48 bg-[var(--surface)] rounded-xl animate-pulse" />
          <div className="h-64 bg-[var(--surface)] rounded-xl animate-pulse" />
        </div>
        <div className="flex flex-col gap-8">
          <div className="h-56 bg-[var(--surface)] rounded-xl animate-pulse" />
          <div className="h-48 bg-[var(--surface)] rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

async function HomepageContent({ scope }: { scope: Scope }) {
  const locale = await getLocale();
  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");
  const tComp = await getTranslations("competition");

  const currentDate = new Date().toISOString().split("T")[0];
  const competitionScopeFilter = buildCompetitionScopeFilter(scope);
  const shooterScopeFilter = buildShooterScopeFilter(scope);

  // All heavy fetches run in parallel
  const [
    tickerComps,
    allVerified,
    recentComps,
    discRows,
    cacheRows,
    upcomingComps,
    calendarComps,
    clubCacheRows,
  ] = await Promise.all([
    // Ticker comps
    db
      .select({
        id:           competitions.id,
        name:         competitions.name,
        nameSr:       competitions.nameSr,
        nameEn:       competitions.nameEn,
        date:         competitions.date,
        level:        competitions.level,
        location:     competitions.location,
        countryCode2: countries.code2,
        nocCode:      countries.nocCode,
      })
      .from(competitions)
      .leftJoin(countries, eq(competitions.countryId, countries.id))
      .where(and(sql`${competitions.date} >= ${currentDate}`, competitionScopeFilter))
      .orderBy(competitions.date)
      .limit(8),

    // All verified shooters for QuickH2H
    db
      .select({
        id: shooters.id,
        firstName: shooters.firstName,
        lastName: shooters.lastName,
        clubName: clubs.name,
        nationality: shooters.nationality,
      })
      .from(shooters)
      .leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .where(and(eq(shooters.verified, true), shooterScopeFilter))
      .orderBy(shooters.lastName, shooters.firstName),

    // Recent competitions (last 3)
    db
      .select()
      .from(competitions)
      .where(competitionScopeFilter)
      .orderBy(desc(competitions.date))
      .limit(3),

    // Discipline max scores (for club leaderboard normalization)
    db.select({ code: disciplines.code, maxQualScore: disciplines.maxQualScore }).from(disciplines),

    // Top forma per discipline — from cache, indexed query
    db
      .select({
        shooterId:    shooterFormaCache.shooterId,
        discCode:     shooterFormaCache.disciplineCode,
        forma:        shooterFormaCache.forma,
        trend:        shooterFormaCache.trend,
        sampleSize:   shooterFormaCache.sampleSize,
        peakCareer:   shooterFormaCache.peakCareer,
        firstName:    shooters.firstName,
        lastName:     shooters.lastName,
        clubName:     clubs.name,
        nationality:  shooters.nationality,
      })
      .from(shooterFormaCache)
      .innerJoin(shooters, eq(shooterFormaCache.shooterId, shooters.id))
      .leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .where(and(
        eq(shooters.verified, true),
        shooterScopeFilter,
        gte(shooterFormaCache.sampleSize, RANKING_MIN_SAMPLE),
        isNotNull(shooterFormaCache.forma),
      )),

    // Upcoming competitions
    db
      .select()
      .from(competitions)
      .where(and(sql`${competitions.date} >= ${currentDate}`, competitionScopeFilter))
      .orderBy(asc(competitions.date))
      .limit(10),

    // Calendar competitions (current year)
    db
      .select()
      .from(competitions)
      .where(and(
        sql`${competitions.date} >= ${`${new Date().getFullYear()}-01-01`} AND ${competitions.date} <= ${`${new Date().getFullYear()}-12-31`}`,
        competitionScopeFilter,
      ))
      .orderBy(asc(competitions.date)),

    // Club leaderboard — cache rows for all verified shooters
    db
      .select({
        clubId:       shooters.clubId,
        clubName:     clubs.name,
        clubCity:     clubs.city,
        discCode:     shooterFormaCache.disciplineCode,
        forma:        shooterFormaCache.forma,
        sampleSize:   shooterFormaCache.sampleSize,
      })
      .from(shooterFormaCache)
      .innerJoin(shooters, eq(shooterFormaCache.shooterId, shooters.id))
      .innerJoin(clubs, eq(shooters.clubId, clubs.id))
      .where(and(
        eq(shooters.verified, true),
        shooterScopeFilter,
        gte(shooterFormaCache.sampleSize, RANKING_MIN_SAMPLE),
        isNotNull(shooterFormaCache.forma),
      )),
  ]);

  // Ticker
  const tickerLive     = tickerComps.filter((c) => c.date === currentDate);
  const tickerUpcoming = tickerComps.filter((c) => c.date > currentDate);

  const liveItems: TickerItem[] = await Promise.all(
    tickerLive.map(async (comp) => {
      const best = await db
        .select({ qualTotal: results.qualTotal, lastName: shooters.lastName, discCode: disciplines.code })
        .from(results)
        .innerJoin(shooters,    eq(results.shooterId,    shooters.id))
        .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
        .where(and(eq(results.competitionId, comp.id), shooterScopeFilter))
        .orderBy(desc(results.qualTotal))
        .limit(1);

      let detailText = t("inProgress");
      if (best[0]) {
        const score = parseFloat(best[0].qualTotal!);
        detailText = `1. ${best[0].lastName} ${score.toFixed(best[0].discCode.startsWith("AP") ? 0 : 1)}`;
      }
      return {
        id: comp.id,
        name: locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name),
        date: comp.date, level: comp.level, status: "LIVE" as const, detailText,
        href: `/takmicenja/${comp.id}`,
        nocCode: comp.nocCode ?? undefined, countryCode2: comp.countryCode2 ?? undefined,
      };
    })
  );

  const upcomingItems: TickerItem[] = tickerUpcoming.map((comp) => ({
    id: comp.id,
    name: locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name),
    date: comp.date, level: comp.level, status: "USKORO" as const,
    detailText: comp.location || tCommon("serbia"),
    href: `/takmicenja/${comp.id}`,
  }));

  // Recent comps with winners (3 queries in parallel)
  const compsWithWinners = await Promise.all(
    recentComps.map(async (comp) => {
      const best = await db
        .select({ qualTotal: results.qualTotal, firstName: shooters.firstName, lastName: shooters.lastName, clubName: clubs.name, discCode: disciplines.code })
        .from(results)
        .innerJoin(shooters, eq(results.shooterId, shooters.id))
        .leftJoin(clubs, eq(shooters.clubId, clubs.id))
        .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
        .where(and(eq(results.competitionId, comp.id), shooterScopeFilter))
        .orderBy(desc(results.qualTotal))
        .limit(1);
      return { ...comp, winner: best[0] || null };
    })
  );

  // Top forma per discipline — from cache (already fetched above)
  // Get recent scores for top-5 per discipline with one IN query
  const topByDisc = Object.fromEntries(
    DISC_CODES.map((code) => [
      code,
      cacheRows
        .filter((r) => r.discCode === code)
        .sort((a, b) => parseFloat(b.forma!) - parseFloat(a.forma!))
        .slice(0, 5),
    ])
  ) as Record<typeof DISC_CODES[number], typeof cacheRows>;

  const allTopIds = [...new Set(Object.values(topByDisc).flat().map((r) => r.shooterId))];

  const recentResultRows = allTopIds.length > 0
    ? await db
        .select({ shooterId: results.shooterId, qualTotal: results.qualTotal, date: competitions.date })
        .from(results)
        .innerJoin(competitions, eq(results.competitionId, competitions.id))
        .where(and(inArray(results.shooterId, allTopIds), isNotNull(results.qualTotal)))
        .orderBy(asc(competitions.date))
    : [];

  const recentScoresByShooter = new Map<number, number[]>();
  for (const r of recentResultRows) {
    const arr = recentScoresByShooter.get(r.shooterId) ?? [];
    arr.push(parseFloat(r.qualTotal!));
    recentScoresByShooter.set(r.shooterId, arr);
  }

  const mapRow = (r: (typeof cacheRows)[number]): ShooterFormRow => ({
    shooterId:    r.shooterId,
    firstName:    r.firstName,
    lastName:     r.lastName,
    clubName:     r.clubName,
    nationality:  r.nationality,
    formaScore:   parseFloat(r.forma!),
    trend:        (r.trend ?? "stable") as "up" | "down" | "stable",
    peak:         r.peakCareer != null ? parseFloat(r.peakCareer) : null,
    entriesCount: r.sampleSize,
    recentScores: recentScoresByShooter.get(r.shooterId) ?? [],
  });

  const topFormaData: { ARM: ShooterFormRow[]; ARW: ShooterFormRow[]; APM: ShooterFormRow[]; APW: ShooterFormRow[] } = {
    ARM: topByDisc.ARM.map(mapRow),
    ARW: topByDisc.ARW.map(mapRow),
    APM: topByDisc.APM.map(mapRow),
    APW: topByDisc.APW.map(mapRow),
  };

  // Translations
  const translatedUpcoming = upcomingComps.map((comp) => ({
    ...comp,
    name: locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name),
  }));

  const translatedCalendar = calendarComps.map((comp) => ({
    ...comp,
    name: locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name),
  }));

  // Club leaderboard — aggregate cache rows in memory
  const maxByCode: Record<string, number> = Object.fromEntries(discRows.map((d) => [d.code, parseFloat(d.maxQualScore)]));

  const clubMap = new Map<number, { name: string; city: string | null; scores: number[] }>();
  for (const row of clubCacheRows) {
    if (!row.clubId) continue;
    const maxScore = maxByCode[row.discCode] ?? 630;
    const pct = (parseFloat(row.forma!) / maxScore) * 100;
    const c = clubMap.get(row.clubId) ?? { name: row.clubName, city: row.clubCity, scores: [] };
    c.scores.push(pct);
    clubMap.set(row.clubId, c);
  }

  const clubRankings = Array.from(clubMap.entries())
    .map(([clubId, c]) => ({
      clubId,
      name: c.name,
      city: c.city,
      avgPct: Math.round((c.scores.reduce((a, b) => a + b, 0) / c.scores.length) * 10) / 10,
      activeShooters: c.scores.length,
    }))
    .sort((a, b) => b.avgPct - a.avgPct)
    .slice(0, 5);

  return (
    <>
      <Ticker liveItems={liveItems} upcomingItems={upcomingItems} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Upcoming Events Carousel – full width */}
      <UpcomingEvents competitions={translatedUpcoming} />

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Main Content (66% width) */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Recent Match Results */}
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-wider text-[var(--ink)]">
                {t("recentCompetitions")}
              </h2>
              <ScopedLink href="/takmicenja" className="text-xs font-semibold text-[var(--brand-primary)] hover:underline">
                {t("allCompsLink")}
              </ScopedLink>
            </div>

            {compsWithWinners.length === 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-12 text-center">
                <p className="text-sm text-[var(--muted)]">{t("noRecentComps")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {compsWithWinners.map((comp) => {
                  const compName = locale === "en" ? (comp.nameEn ?? comp.name) : (comp.nameSr ?? comp.name);
                  const levelKey = `levels.${comp.level.toLowerCase()}`;
                  const levelLabel = tComp.has(levelKey) ? tComp(levelKey) : comp.level;

                  return (
                    <div
                      key={comp.id}
                      className="flex flex-col justify-between border border-[var(--border)] rounded-xl bg-[var(--bg)] overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {/* Comp Header */}
                      <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2 flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">
                          {levelLabel}
                        </span>
                        <h4 className="font-semibold text-xs text-[var(--ink)] truncate" title={compName}>
                          {compName}
                        </h4>
                      </div>

                      {/* Comp Info */}
                      <div className="p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--subtle)]">{tComp("list.location")}:</span>
                          <span className="font-medium text-[var(--ink)] truncate max-w-[120px]">{comp.location || "—"}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[var(--subtle)]">{tComp("list.date")}:</span>
                          <span className="font-mono text-[var(--ink)]">{comp.date.split("-").reverse().join(".")}</span>
                        </div>

                        {/* Top Result / Winner */}
                        <div className="border-t border-[var(--border)] pt-2.5 mt-1 flex flex-col gap-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--subtle)]">
                            {t("winner")}
                          </span>
                          {comp.winner ? (
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex flex-col truncate">
                                <span className="font-semibold text-[var(--ink)] truncate">
                                  {comp.winner.lastName} {comp.winner.firstName}
                                </span>
                                <span className="text-[10px] text-[var(--muted)] truncate">
                                  {comp.winner.clubName || "Bez kluba"}
                                </span>
                              </div>
                              <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--brand-primary)] bg-[var(--brand-primary-light)] px-1.5 py-0.5 rounded text-xs">
                                {parseFloat(comp.winner.qualTotal!).toFixed(comp.winner.discCode.startsWith("AP") ? 0 : 1)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--muted)] font-normal italic">{tComp("detail.noResults")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Top Form discipline switcher */}
          <section className="flex flex-col gap-4">
            <TopFormaClient initialData={topFormaData} />
          </section>
        </div>

        {/* Right Column - Sidebars (33% width) */}
        <div className="flex flex-col gap-8">

          {/* Calendar Module – top of sidebar */}
          <CalendarModule competitions={translatedCalendar} />

          {/* Club Leaderboard */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
            <div className="bg-[var(--brand-primary)] px-4 py-3 border-b border-[var(--border)]">
              <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg text-white uppercase tracking-wider">
                {t("clubLeaderboard")}
              </h3>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {clubRankings.length === 0 ? (
                <p className="text-xs text-[var(--muted)] text-center py-4">{t("noClubData")}</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {clubRankings.map((c, i) => (
                    <div key={c.clubId} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-[family-name:var(--font-barlow-condensed)] font-extrabold text-sm text-[var(--subtle)] w-4 text-right">
                          {i + 1}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-[var(--ink)]">{c.name}</span>
                          <span className="text-[10px] text-[var(--muted)]">{c.city || tCommon("serbia")}</span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)]">
                          {c.avgPct.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-[var(--subtle)]">
                          {t("activeShooters", { count: c.activeShooters })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Quick H2H Duel Widget – bottom of sidebar */}
          <section>
            <QuickH2HClient shootersList={allVerified} />
          </section>

        </div>
      </div>

      {/* News Section – full width below grid */}
      <NewsSection />
      </div>
    </>
  );
}
