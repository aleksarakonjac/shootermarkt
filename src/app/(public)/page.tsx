import React from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { shooters, clubs, results, disciplines, competitions, calendarAlerts } from "@/lib/db/schema";
import { eq, desc, asc, and, isNotNull, sql } from "drizzle-orm";
import { computeFormaScore } from "@/lib/forma-score";
import { TopFormaClient } from "./top-forma-client";
import { QuickH2HClient } from "./quick-h2h-client";
import { SearchBarClient } from "./search-bar-client";
import { Ticker, TickerItem } from "./ticker";
import "./homepage.css";
export const metadata = {
  title: "Početna | Shootermarkt",
  description: "Centralni dashboard za rezultate, formu i rangiranje srpskih strelaca",
};

export const dynamic = "force-dynamic";

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

export default async function HomePage() {
  const currentDate = new Date().toISOString().split("T")[0];

  // Fetch competitions for the top ticker (latest 6)
  const tickerComps = await db
    .select()
    .from(competitions)
    .orderBy(desc(competitions.date))
    .limit(6);

  const tickerItems: TickerItem[] = await Promise.all(
    tickerComps.map(async (comp) => {
      const best = await db
        .select({
          qualTotal: results.qualTotal,
          lastName: shooters.lastName,
          discCode: disciplines.code,
        })
        .from(results)
        .innerJoin(shooters, eq(results.shooterId, shooters.id))
        .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
        .where(eq(results.competitionId, comp.id))
        .orderBy(desc(results.qualTotal))
        .limit(1);

      const isToday = comp.date === currentDate;
      const isFuture = comp.date > currentDate;

      let status: "LIVE" | "KRAJ" | "NAJAVA" = "KRAJ";
      if (isToday) status = "LIVE";
      else if (isFuture) status = "NAJAVA";

      let detailText = "Nema rezultata";
      if (status === "NAJAVA") {
        detailText = comp.location || "Srbija";
      } else if (best[0]) {
        const parsedScore = parseFloat(best[0].qualTotal!);
        const formattedScore = parsedScore.toFixed(best[0].discCode.startsWith("AP") ? 0 : 1);
        detailText = `${best[0].lastName} (${formattedScore})`;
      }

      return {
        id: comp.id,
        name: comp.name,
        date: comp.date,
        level: comp.level,
        status,
        detailText,
      };
    })
  );

  // 1. Fetch all verified shooters with their club info
  const allVerified = await db
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      clubName: clubs.name,
      nationality: shooters.nationality,
    })
    .from(shooters)
    .leftJoin(clubs, eq(shooters.clubId, clubs.id))
    .where(eq(shooters.verified, true))
    .orderBy(shooters.lastName, shooters.firstName);

  // 2. Fetch recent competitions (last 3) and find the top shooter for each
  const recentComps = await db
    .select()
    .from(competitions)
    .orderBy(desc(competitions.date))
    .limit(3);

  const compsWithWinners = await Promise.all(
    recentComps.map(async (comp) => {
      const best = await db
        .select({
          qualTotal: results.qualTotal,
          firstName: shooters.firstName,
          lastName: shooters.lastName,
          clubName: clubs.name,
          discCode: disciplines.code,
        })
        .from(results)
        .innerJoin(shooters, eq(results.shooterId, shooters.id))
        .leftJoin(clubs, eq(shooters.clubId, clubs.id))
        .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
        .where(eq(results.competitionId, comp.id))
        .orderBy(desc(results.qualTotal))
        .limit(1);

      return {
        ...comp,
        winner: best[0] || null,
      };
    })
  );

  // 3. Fetch data for Top Forma per discipline
  const activeDisciplines = await db.select().from(disciplines);

  const topFormaData: {
    ARM: ShooterFormRow[];
    ARW: ShooterFormRow[];
    APM: ShooterFormRow[];
    APW: ShooterFormRow[];
  } = {
    ARM: [],
    ARW: [],
    APM: [],
    APW: [],
  };

  // Pre-fetch results for form scores
  for (const disc of activeDisciplines) {
    const rawResults = await db
      .select({
        shooterId: results.shooterId,
        firstName: shooters.firstName,
        lastName: shooters.lastName,
        nationality: shooters.nationality,
        clubName: clubs.name,
        qualTotal: results.qualTotal,
        competitionDate: competitions.date,
      })
      .from(results)
      .innerJoin(shooters, eq(results.shooterId, shooters.id))
      .leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .innerJoin(competitions, eq(results.competitionId, competitions.id))
      .where(and(eq(results.disciplineId, disc.id), isNotNull(results.qualTotal)))
      .orderBy(asc(competitions.date));

    // Group by shooter
    const shooterMap = new Map<
      number,
      {
        firstName: string;
        lastName: string;
        nationality: string | null;
        clubName: string | null;
        entries: { qualTotal: number; date: string }[];
      }
    >();

    for (const r of rawResults) {
      if (!shooterMap.has(r.shooterId)) {
        shooterMap.set(r.shooterId, {
          firstName: r.firstName,
          lastName: r.lastName,
          nationality: r.nationality,
          clubName: r.clubName,
          entries: [],
        });
      }
      shooterMap.get(r.shooterId)!.entries.push({
        qualTotal: parseFloat(r.qualTotal!),
        date: r.competitionDate,
      });
    }

    const maxScore = parseFloat(disc.maxQualScore);

    const ranking = Array.from(shooterMap.entries())
      .map(([shooterId, data]) => {
        const forma = computeFormaScore(data.entries, maxScore);
        const peak = data.entries.length > 0 ? Math.max(...data.entries.map((e) => e.qualTotal)) : null;
        
        // Dynamic sort entries desc by date to get recent scores
        const sortedScores = [...data.entries]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((e) => e.qualTotal);

        return {
          shooterId,
          firstName: data.firstName,
          lastName: data.lastName,
          clubName: data.clubName,
          nationality: data.nationality,
          formaScore: forma ? forma.score : 0,
          trend: forma ? forma.trend : ("stable" as const),
          peak,
          entriesCount: data.entries.length,
          recentScores: sortedScores,
        };
      })
      .filter((s) => s.entriesCount >= 2) // only shooters with enough data for form score
      .sort((a, b) => b.formaScore - a.formaScore)
      .slice(0, 5); // top 5 only

    if (disc.code === "ARM") topFormaData.ARM = ranking;
    if (disc.code === "ARW") topFormaData.ARW = ranking;
    if (disc.code === "APM") topFormaData.APM = ranking;
    if (disc.code === "APW") topFormaData.APW = ranking;
  }

  // 4. Fetch upcoming competitions
  const upcomingComps = await db
    .select()
    .from(competitions)
    .where(sql`${competitions.date} >= ${currentDate}`)
    .orderBy(asc(competitions.date))
    .limit(3);

  // Fetch recent alerts for calendar
  const recentAlerts = await db
    .select()
    .from(calendarAlerts)
    .where(eq(calendarAlerts.seen, false))
    .orderBy(desc(calendarAlerts.createdAt))
    .limit(3);

  // 5. Club Leaderboard: Group shooters by club, calculate average form score
  const clubAvgForm = await db
    .select({
      clubId: shooters.clubId,
      clubName: clubs.name,
      clubCity: clubs.city,
      countShooters: sql<number>`count(distinct ${shooters.id})`,
    })
    .from(shooters)
    .innerJoin(clubs, eq(shooters.clubId, clubs.id))
    .where(eq(shooters.verified, true))
    .groupBy(shooters.clubId, clubs.name, clubs.city);

  // Process club rankings based on shooter form scores
  const clubRankingPromise = clubAvgForm.map(async (c) => {
    if (!c.clubId) return null;

    // Fetch all shooters for this club
    const clubShooters = await db
      .select({ id: shooters.id })
      .from(shooters)
      .where(and(eq(shooters.clubId, c.clubId), eq(shooters.verified, true)));

    const shooterIds = clubShooters.map((s) => s.id);
    if (shooterIds.length === 0) return null;

    // Fetch results for these shooters
    const clubResults = await db
      .select({
        shooterId: results.shooterId,
        qualTotal: results.qualTotal,
        date: competitions.date,
        discMax: disciplines.maxQualScore,
        discCode: disciplines.code,
      })
      .from(results)
      .innerJoin(competitions, eq(results.competitionId, competitions.id))
      .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .where(and(
        sql`${results.shooterId} IN (${sql.join(shooterIds)})`,
        isNotNull(results.qualTotal)
      ));

    // Calculate form score for each shooter
    const shooterFormScores: number[] = [];
    const shooterEntries: { [id: number]: { qualTotal: number; date: string; max: number }[] } = {};

    for (const r of clubResults) {
      if (!shooterEntries[r.shooterId]) {
        shooterEntries[r.shooterId] = [];
      }
      shooterEntries[r.shooterId].push({
        qualTotal: parseFloat(r.qualTotal!),
        date: r.date,
        max: parseFloat(r.discMax),
      });
    }

    for (const [_, entries] of Object.entries(shooterEntries)) {
      if (entries.length < 2) continue;
      const maxScore = entries[0].max;
      const forma = computeFormaScore(entries, maxScore);
      if (forma) {
        // Normalize score to percentage of max for fair club comparison
        const pct = (forma.score / maxScore) * 100;
        shooterFormScores.push(pct);
      }
    }

    if (shooterFormScores.length === 0) return null;

    const avgPct = shooterFormScores.reduce((a, b) => a + b, 0) / shooterFormScores.length;

    return {
      clubId: c.clubId,
      name: c.clubName,
      city: c.clubCity,
      avgPct: Math.round(avgPct * 10) / 10,
      activeShooters: shooterFormScores.length,
    };
  });

  const clubRankings = (await Promise.all(clubRankingPromise))
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.avgPct - a.avgPct)
    .slice(0, 5);

  return (
    <>
      <Ticker items={tickerItems} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)]">
            Digitalna Streljačka Platforma
          </span>
          <h1 className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)] text-3xl sm:text-4xl mt-1">
            Shootermarkt Dashboard
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Živi rezultati, klupske statistike i merenje forme srpskih strelaca u realnom vremenu.
          </p>
        </div>
      </div>

      {/* Instant Autocomplete Search Bar */}
      <SearchBarClient shootersList={allVerified} />

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Main Content (66% width) */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Recent Match Results */}
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-wider text-[var(--ink)]">
                Nedavni Rezultati
              </h2>
              <Link href="/takmicenja" className="text-xs font-semibold text-[var(--brand-primary)] hover:underline">
                Sva takmičenja →
              </Link>
            </div>

            {compsWithWinners.length === 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-12 text-center">
                <p className="text-sm text-[var(--muted)]">Nema skoro unetih rezultata.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {compsWithWinners.map((comp) => (
                  <div
                    key={comp.id}
                    className="flex flex-col justify-between border border-[var(--border)] rounded-xl bg-[var(--bg)] overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Comp Header */}
                    <div className="bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2 flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider">
                        {comp.level}
                      </span>
                      <h4 className="font-semibold text-xs text-[var(--ink)] truncate" title={comp.name}>
                        {comp.name}
                      </h4>
                    </div>

                    {/* Comp Info */}
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--subtle)]">Lokacija:</span>
                        <span className="font-medium text-[var(--ink)] truncate max-w-[120px]">{comp.location || "—"}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--subtle)]">Datum:</span>
                        <span className="font-mono text-[var(--ink)]">{comp.date}</span>
                      </div>

                      {/* Top Result / Winner */}
                      <div className="border-t border-[var(--border)] pt-2.5 mt-1 flex flex-col gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--subtle)]">
                          Najbolji rezultat
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
                          <span className="text-xs text-[var(--muted)] font-normal italic">Nema unetih rezultata</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
          
          {/* Quick H2H Duel Widget */}
          <section>
            <QuickH2HClient shootersList={allVerified} />
          </section>

          {/* Upcoming Calendar / Announcements */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
            <div className="bg-[var(--brand-accent)] px-4 py-3 border-b border-[var(--border)]">
              <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg text-white uppercase tracking-wider">
                Kalendar Takmičenja
              </h3>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {upcomingComps.length === 0 && recentAlerts.length === 0 ? (
                <p className="text-xs text-[var(--muted)] text-center py-4">Nema predstojećih takmičenja u kalendaru.</p>
              ) : (
                <>
                  {/* Real upcoming comps */}
                  {upcomingComps.map((comp) => (
                    <div
                      key={comp.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center bg-[var(--bg)] border border-[var(--border-strong)] rounded w-10 py-1.5 font-[family-name:var(--font-barlow-condensed)] leading-none">
                        <span className="text-[10px] uppercase font-bold text-[var(--muted)]">
                          {new Date(comp.date).toLocaleString("sr-RS", { month: "short" }).substring(0, 3)}
                        </span>
                        <span className="text-sm font-extrabold text-[var(--ink)] mt-0.5">
                          {new Date(comp.date).getDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-xs text-[var(--ink)] truncate" title={comp.name}>
                          {comp.name}
                        </h4>
                        <p className="text-[10px] text-[var(--muted)] truncate mt-0.5">
                          {comp.location || "Nije definisana lokacija"}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Sync alerts / Unseen calendar alerts */}
                  {recentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 p-2.5 rounded-lg border border-[rgba(194,0,0,0.15)] bg-[rgba(194,0,0,0.02)]"
                    >
                      <div className="flex items-center justify-center rounded-full bg-[var(--brand-primary-light)] text-[var(--brand-primary)] w-5 h-5 shrink-0 text-[10px] font-bold mt-0.5">
                        !
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[8px] font-bold text-[var(--brand-primary)] uppercase tracking-wider block">
                          Nova najava ({alert.source.toUpperCase()})
                        </span>
                        <h4 className="font-semibold text-xs text-[var(--ink)] truncate mt-0.5" title={alert.eventName}>
                          {alert.eventName}
                        </h4>
                        <p className="text-[10px] text-[var(--muted)] truncate mt-0.5">
                          {alert.data?.dateFrom ? `${alert.data.dateFrom} · ` : ""} {alert.data?.location || "Nepoznato"}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          {/* Club Leaderboard */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
            <div className="bg-[var(--brand-accent)] px-4 py-3 border-b border-[var(--border)]">
              <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg text-white uppercase tracking-wider">
                Klupski Leaderboard
              </h3>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {clubRankings.length === 0 ? (
                <p className="text-xs text-[var(--muted)] text-center py-4">Nedovoljno podataka za rangiranje klubova.</p>
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
                          <span className="text-[10px] text-[var(--muted)]">{c.city || "Srbija"}</span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)]">
                          {c.avgPct.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-[var(--subtle)]">
                          {c.activeShooters} {c.activeShooters === 1 ? "strelac" : "strelaca"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
      </div>
    </>
  );
}
