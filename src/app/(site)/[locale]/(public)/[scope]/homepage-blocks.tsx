import { ScopedLink } from "../components/ScopedLink";
import { Ticker, type TickerItem } from "../ticker";
import { UpcomingEvents } from "../components/UpcomingEvents";
import { TopFormaClient } from "./top-forma-client";
import { db } from "@/lib/db";
import { clubs, competitions, countries, disciplines, results, shooterFormaCache, shooters } from "@/lib/db/schema";
import { RANKING_MIN_SAMPLE } from "@/lib/forma";
import { buildCompetitionScopeFilter, buildShooterScopeFilter, type Scope } from "@/lib/scope";
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";

const DISC_CODES = ["ARM", "ARW", "APM", "APW"] as const;

type ShooterFormRow = {
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
};

export async function HomepageTicker({ scope }: { scope: Scope }) {
  console.info("[homepage-timing] ticker:start", { scope });
  const [locale, t, tCommon] = await Promise.all([getLocale(), getTranslations("home"), getTranslations("common")]);
  const today = new Date().toISOString().slice(0, 10);
  const scopeFilter = buildCompetitionScopeFilter(scope);
  const competitionsForTicker = await db
    .select({ id: competitions.id, name: competitions.name, nameSr: competitions.nameSr, nameEn: competitions.nameEn, date: competitions.date, level: competitions.level, location: competitions.location, countryCode2: countries.code2, nocCode: countries.nocCode })
    .from(competitions)
    .leftJoin(countries, eq(competitions.countryId, countries.id))
    .where(and(sql`${competitions.date} >= ${today}`, scopeFilter))
    .orderBy(competitions.date)
    .limit(8);
  console.info("[homepage-timing] ticker:competitions", { count: competitionsForTicker.length });

  const liveItems: TickerItem[] = await Promise.all(competitionsForTicker.filter((competition) => competition.date === today).map(async (competition) => {
    const best = await db.select({ qualTotal: results.qualTotal, lastName: shooters.lastName, discCode: disciplines.code })
      .from(results).innerJoin(shooters, eq(results.shooterId, shooters.id)).innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .where(and(eq(results.competitionId, competition.id), buildShooterScopeFilter(scope))).orderBy(desc(results.qualTotal)).limit(1);
    return {
      id: competition.id,
      name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name),
      date: competition.date, level: competition.level, status: "LIVE" as const,
      detailText: best[0] ? `1. ${best[0].lastName} ${Number(best[0].qualTotal).toFixed(best[0].discCode.startsWith("AP") ? 0 : 1)}` : t("inProgress"),
      href: `/takmicenja/${competition.id}`, nocCode: competition.nocCode ?? undefined, countryCode2: competition.countryCode2 ?? undefined,
    };
  }));

  const upcomingItems: TickerItem[] = competitionsForTicker.filter((competition) => competition.date > today).map((competition) => ({
    id: competition.id,
    name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name),
    date: competition.date, level: competition.level, status: "USKORO" as const,
    detailText: competition.location || tCommon("serbia"), href: `/takmicenja/${competition.id}`,
  }));
  console.info("[homepage-timing] ticker:done");
  return <Ticker liveItems={liveItems} upcomingItems={upcomingItems} />;
}

export async function HomepageMain({ scope }: { scope: Scope }) {
  console.info("[homepage-timing] main:start", { scope });
  const [locale, t, tComp] = await Promise.all([getLocale(), getTranslations("home"), getTranslations("competition")]);
  const today = new Date().toISOString().slice(0, 10);
  const competitionScopeFilter = buildCompetitionScopeFilter(scope);
  const shooterScopeFilter = buildShooterScopeFilter(scope);
  const [recentComps, cacheRows, upcomingComps] = await Promise.all([
    db.select().from(competitions).where(competitionScopeFilter).orderBy(desc(competitions.date)).limit(3),
    db.select({ shooterId: shooterFormaCache.shooterId, discCode: shooterFormaCache.disciplineCode, forma: shooterFormaCache.forma, trend: shooterFormaCache.trend, sampleSize: shooterFormaCache.sampleSize, peakCareer: shooterFormaCache.peakCareer, firstName: shooters.firstName, lastName: shooters.lastName, clubName: clubs.name, nationality: shooters.nationality })
      .from(shooterFormaCache).innerJoin(shooters, eq(shooterFormaCache.shooterId, shooters.id)).leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .where(and(eq(shooters.verified, true), shooterScopeFilter, gte(shooterFormaCache.sampleSize, RANKING_MIN_SAMPLE), isNotNull(shooterFormaCache.forma))),
    db.select().from(competitions).where(and(sql`${competitions.date} >= ${today}`, competitionScopeFilter)).orderBy(asc(competitions.date)).limit(10),
  ]);
  console.info("[homepage-timing] main:base-data", { cacheRows: cacheRows.length, recentComps: recentComps.length, upcomingComps: upcomingComps.length });
  const compsWithWinners = await Promise.all(recentComps.map(async (competition) => {
    const winner = await db.select({ qualTotal: results.qualTotal, firstName: shooters.firstName, lastName: shooters.lastName, clubName: clubs.name, discCode: disciplines.code })
      .from(results).innerJoin(shooters, eq(results.shooterId, shooters.id)).leftJoin(clubs, eq(shooters.clubId, clubs.id)).innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .where(and(eq(results.competitionId, competition.id), shooterScopeFilter)).orderBy(desc(results.qualTotal)).limit(1);
    return { ...competition, winner: winner[0] ?? null };
  }));
  console.info("[homepage-timing] main:winners");
  const topByDisc = Object.fromEntries(DISC_CODES.map((code) => [code, cacheRows.filter((row) => row.discCode === code).sort((a, b) => Number(b.forma) - Number(a.forma)).slice(0, 5)])) as Record<typeof DISC_CODES[number], typeof cacheRows>;
  const topIds = [...new Set(Object.values(topByDisc).flat().map((row) => row.shooterId))];
  const scoreRows = topIds.length ? await db.select({ shooterId: results.shooterId, qualTotal: results.qualTotal }).from(results).where(and(inArray(results.shooterId, topIds), isNotNull(results.qualTotal))) : [];
  console.info("[homepage-timing] main:scores", { count: scoreRows.length });
  const scores = new Map<number, number[]>();
  for (const row of scoreRows) scores.set(row.shooterId, [...(scores.get(row.shooterId) ?? []), Number(row.qualTotal)]);
  const mapForm = (row: (typeof cacheRows)[number]): ShooterFormRow => ({ shooterId: row.shooterId, firstName: row.firstName, lastName: row.lastName, clubName: row.clubName, nationality: row.nationality, formaScore: Number(row.forma), trend: (row.trend ?? "stable") as ShooterFormRow["trend"], peak: row.peakCareer == null ? null : Number(row.peakCareer), entriesCount: row.sampleSize, recentScores: scores.get(row.shooterId) ?? [] });
  const topFormaData = { ARM: topByDisc.ARM.map(mapForm), ARW: topByDisc.ARW.map(mapForm), APM: topByDisc.APM.map(mapForm), APW: topByDisc.APW.map(mapForm) };
  const translatedUpcoming = upcomingComps.map((competition) => ({ ...competition, name: locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name) }));
  console.info("[homepage-timing] main:done");

  return <>
    <UpcomingEvents competitions={translatedUpcoming} />
    <section className="mt-8 flex flex-col gap-4">
      <div className="flex items-baseline justify-between"><h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-wider text-[var(--ink)]">{t("recentCompetitions")}</h2><ScopedLink href="/takmicenja" className="text-xs font-semibold text-[var(--brand-primary)] hover:underline">{t("allCompsLink")}</ScopedLink></div>
      {compsWithWinners.length === 0 ? <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-12 text-center text-sm text-[var(--muted)]">{t("noRecentComps")}</div> : <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{compsWithWinners.map((competition) => {
        const name = locale === "en" ? (competition.nameEn ?? competition.name) : (competition.nameSr ?? competition.name);
        const levelKey = `levels.${competition.level.toLowerCase()}`;
        return <div key={competition.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4"><p className="text-[9px] font-bold uppercase text-[var(--muted)]">{tComp.has(levelKey) ? tComp(levelKey) : competition.level}</p><h3 className="mt-1 truncate text-xs font-semibold">{name}</h3><p className="mt-3 text-xs text-[var(--muted)]">{competition.date.split("-").reverse().join(".")} · {competition.location || "—"}</p><div className="mt-3 border-t border-[var(--border)] pt-2 text-xs">{competition.winner ? <><span className="font-semibold">{competition.winner.lastName} {competition.winner.firstName}</span><span className="float-right font-mono font-bold text-[var(--brand-primary)]">{Number(competition.winner.qualTotal).toFixed(competition.winner.discCode.startsWith("AP") ? 0 : 1)}</span></> : <span className="italic text-[var(--muted)]">{tComp("detail.noResults")}</span>}</div></div>;
      })}</div>}
    </section>
    <section className="mt-8"><TopFormaClient initialData={topFormaData} /></section>
  </>;
}

export async function HomepageClubLeaderboard({ scope }: { scope: Scope }) {
  console.info("[homepage-timing] clubs:start", { scope });
  const [t, tCommon, discRows, cacheRows] = await Promise.all([getTranslations("home"), getTranslations("common"), db.select({ code: disciplines.code, maxQualScore: disciplines.maxQualScore }).from(disciplines), db.select({ clubId: shooters.clubId, clubName: clubs.name, clubCity: clubs.city, discCode: shooterFormaCache.disciplineCode, forma: shooterFormaCache.forma }).from(shooterFormaCache).innerJoin(shooters, eq(shooterFormaCache.shooterId, shooters.id)).innerJoin(clubs, eq(shooters.clubId, clubs.id)).where(and(eq(shooters.verified, true), buildShooterScopeFilter(scope), gte(shooterFormaCache.sampleSize, RANKING_MIN_SAMPLE), isNotNull(shooterFormaCache.forma)))]);
  console.info("[homepage-timing] clubs:data", { cacheRows: cacheRows.length, discRows: discRows.length });
  const maxScores = Object.fromEntries(discRows.map((discipline) => [discipline.code, Number(discipline.maxQualScore)]));
  const clubsById = new Map<number, { name: string; city: string | null; scores: number[] }>();
  for (const row of cacheRows) if (row.clubId) { const entry = clubsById.get(row.clubId) ?? { name: row.clubName, city: row.clubCity, scores: [] }; entry.scores.push((Number(row.forma) / (maxScores[row.discCode] ?? 630)) * 100); clubsById.set(row.clubId, entry); }
  const rankings = Array.from(clubsById.entries()).map(([clubId, club]) => ({ clubId, ...club, avg: club.scores.reduce((sum, value) => sum + value, 0) / club.scores.length })).sort((a, b) => b.avg - a.avg).slice(0, 5);
  console.info("[homepage-timing] clubs:done");
  return <section className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden"><div className="bg-[var(--brand-primary)] px-4 py-3"><h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-lg text-white uppercase">{t("clubLeaderboard")}</h3></div><div className="p-4">{rankings.length === 0 ? <p className="py-4 text-center text-xs text-[var(--muted)]">{t("noClubData")}</p> : rankings.map((club, index) => <div key={club.clubId} className="flex items-center justify-between py-1.5 text-xs"><span><b className="mr-3 text-[var(--subtle)]">{index + 1}</b><b>{club.name}</b> <span className="text-[var(--muted)]">{club.city || tCommon("serbia")}</span></span><span className="font-mono font-bold">{club.avg.toFixed(1)}%</span></div>)}</div></section>;
}
