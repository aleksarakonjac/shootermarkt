export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { shooters, clubs, results, competitions } from "@/lib/db/schema";
import { eq, asc, ilike, or, and, isNotNull, inArray, sql, desc, gte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { NOC_LIST } from "@/lib/noc-list";
import { MVP_APPARATUS } from "@/lib/mvp-scope";
import { StrelciFilterBar } from "./StrelciFilterBar";

export const metadata = { title: "Strelci" };

const PAGE_SIZE = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────

const DISC_STYLE: Record<string, { label: string }> = {
  ARM: { label: "Puška M"   },
  ARW: { label: "Puška Ž"   },
  APM: { label: "Pištolj M" },
  APW: { label: "Pištolj Ž" },
};

function getDiscCode(apparatus: string | null, gender: string | null): string | null {
  if (apparatus === "rifle")  return gender === "F" ? "ARW" : "ARM";
  if (apparatus === "pistol") return gender === "F" ? "APW" : "APM";
  return null;
}

function computeFormaAndTrend(scores: number[]): {
  forma: number | null;
  trend: "up" | "down" | "stable";
} {
  const s = scores.slice(0, 10);
  if (s.length === 0) return { forma: null, trend: "stable" };

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const a1 = avg(s.slice(0, 3))!;
  const a2 = avg(s.slice(3, 6)) ?? a1;
  const a3 = avg(s.slice(6, 10)) ?? a1;
  const forma = a1 * 0.5 + a2 * 0.3 + a3 * 0.2;

  let trend: "up" | "down" | "stable" = "stable";
  if (s.length >= 4) {
    const prevArr = s.slice(3, 6);
    if (prevArr.length > 0) {
      const delta = a1 - (avg(prevArr) ?? a1);
      if (delta > 1.0) trend = "up";
      else if (delta < -1.0) trend = "down";
    }
  }

  return { forma, trend };
}

// ── Dummy data (shown until real forma scores exist) ─────────────────────────

type FormaEntry = {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  clubName: string | null;
  forma: number;
  trend: "up" | "down" | "stable";
};

const DUMMY_RIFLE: FormaEntry[] = [
  { id: -1, firstName: "Marko",    lastName: "Petrović",    avatarUrl: null, clubName: "SK Pančevo 1813",   forma: 634.2, trend: "up"     },
  { id: -2, firstName: "Stefan",   lastName: "Jović",       avatarUrl: null, clubName: "SK Crvena zvezda",  forma: 631.8, trend: "stable" },
  { id: -3, firstName: "Nikola",   lastName: "Đorđić",      avatarUrl: null, clubName: "SK Partizan",       forma: 629.5, trend: "up"     },
];

const DUMMY_PISTOL: FormaEntry[] = [
  { id: -4, firstName: "Ana",      lastName: "Nikolić",     avatarUrl: null, clubName: "SK Vojvodina",      forma: 577.0, trend: "up"     },
  { id: -5, firstName: "Milena",   lastName: "Ilić",        avatarUrl: null, clubName: "SK Crvena zvezda",  forma: 575.3, trend: "down"   },
  { id: -6, firstName: "Bojana",   lastName: "Kovačević",   avatarUrl: null, clubName: "SK Partizan",       forma: 572.1, trend: "stable" },
];

// ── Forma Leader Row ─────────────────────────────────────────────────────────

function FormaLeaderRow({
  s,
  rank,
  isDummy = false,
}: {
  s: FormaEntry;
  rank: number;
  isDummy?: boolean;
}) {
  const inner = (
    <>
      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] font-bold text-[var(--subtle)] w-3 shrink-0 tabular-nums text-center">
        {rank}
      </span>
      <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--surface-2)] flex items-center justify-center overflow-hidden border border-[var(--border)]">
        {s.avatarUrl ? (
          <Image src={s.avatarUrl} alt="" width={28} height={28} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[0.6rem] font-bold text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)] leading-none select-none">
            {s.firstName[0]}{s.lastName[0]}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-[var(--ink)] group-hover:text-[var(--brand-primary)] transition-colors truncate leading-snug">
          {s.lastName} {s.firstName}
        </div>
        {s.clubName && (
          <div className="text-[0.7rem] text-[var(--muted)] truncate leading-none mt-0.5">
            {s.clubName}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)] tabular-nums text-sm">
          {s.forma.toFixed(1)}
        </span>
        <span
          className="text-xs font-bold w-3 text-center leading-none"
          style={{
            color:
              s.trend === "up"   ? "var(--success)"        :
              s.trend === "down" ? "var(--brand-primary)"  :
                                   "var(--subtle)",
          }}
          aria-label={s.trend === "up" ? "u porastu" : s.trend === "down" ? "u padu" : "stabilno"}
        >
          {s.trend === "up" ? "↑" : s.trend === "down" ? "↓" : "→"}
        </span>
      </div>
    </>
  );

  const rowClass = "flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg transition-colors group border-b border-[var(--border)] last:border-0";

  if (isDummy) {
    return <div className={rowClass}>{inner}</div>;
  }

  return (
    <Link href={`/strelci/${s.id}`} className={`${rowClass} hover:bg-[var(--surface-2)]`}>
      {inner}
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type SortCol = "name" | "godiste" | "disc";
type SortDir = "asc" | "desc";

type Props = {
  searchParams: Promise<{
    q?: string;
    zemlja?: string;
    pol?: string;
    aparat?: string;
    page?: string;
    sort?: string;
    dir?: string;
  }>;
};

export default async function StrelciPage({ searchParams }: Props) {
  const sp           = await searchParams;
  const activeQ      = sp.q?.trim() ?? "";
  const activeZemlja = sp.zemlja ?? "";
  const activePol    = sp.pol ?? "";
  const activeAparat = sp.aparat ?? "";
  const page         = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset       = (page - 1) * PAGE_SIZE;
  const thisYear     = String(new Date().getFullYear());
  const activeSort   = (["name", "godiste", "disc"].includes(sp.sort ?? "") ? sp.sort : "name") as SortCol;
  const activeDir    = (sp.dir === "desc" ? "desc" : "asc") as SortDir;

  const conditions: (SQL | undefined)[] = [
    inArray(shooters.apparatus, [...MVP_APPARATUS]),
    activeQ      ? or(ilike(shooters.firstName, `%${activeQ}%`), ilike(shooters.lastName, `%${activeQ}%`)) : undefined,
    activeZemlja ? eq(shooters.nationality, activeZemlja) : undefined,
    activePol    ? eq(shooters.gender, activePol) : undefined,
    activeAparat ? eq(shooters.apparatus, activeAparat) : undefined,
  ].filter((c): c is SQL => c !== undefined);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [
    data,
    [{ totalCount }],
    nocRows,
    statsActiveRows,
    statsApparatus,
    [{ totalAll }],
    allFormaShooters,
  ] = await Promise.all([
    db
      .select({
        id:          shooters.id,
        firstName:   shooters.firstName,
        lastName:    shooters.lastName,
        birthYear:   shooters.birthYear,
        gender:      shooters.gender,
        verified:    shooters.verified,
        nationality: shooters.nationality,
        apparatus:   shooters.apparatus,
        avatarUrl:   shooters.avatarUrl,
        clubName:    clubs.name,
        clubCity:    clubs.city,
      })
      .from(shooters)
      .leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .where(where)
      .orderBy(
        ...(activeSort === "godiste"
          ? [activeDir === "desc" ? desc(shooters.birthYear) : asc(shooters.birthYear), asc(shooters.lastName)]
          : activeSort === "disc"
          ? [activeDir === "desc" ? desc(shooters.apparatus) : asc(shooters.apparatus), asc(shooters.lastName)]
          : [activeDir === "desc" ? desc(shooters.lastName) : asc(shooters.lastName), asc(shooters.firstName)]
        )
      )
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ totalCount: sql<number>`COUNT(*)::int` })
      .from(shooters)
      .where(where),

    db
      .selectDistinct({ noc: shooters.nationality })
      .from(shooters)
      .where(isNotNull(shooters.nationality))
      .orderBy(asc(shooters.nationality)),

    // Active this year = at least 1 result in current year
    db
      .selectDistinct({ id: results.shooterId })
      .from(results)
      .innerJoin(competitions, eq(results.competitionId, competitions.id))
      .innerJoin(shooters, eq(results.shooterId, shooters.id))
      .where(and(
        gte(competitions.date, `${thisYear}-01-01`),
        inArray(shooters.apparatus, [...MVP_APPARATUS]),
      )),

    // Breakdown by apparatus (global, unfiltered)
    db
      .select({ apparatus: shooters.apparatus, count: sql<number>`COUNT(*)::int` })
      .from(shooters)
      .where(inArray(shooters.apparatus, [...MVP_APPARATUS]))
      .groupBy(shooters.apparatus),

    // Total shooters in MVP scope (unfiltered)
    db
      .select({ totalAll: sql<number>`COUNT(*)::int` })
      .from(shooters)
      .where(inArray(shooters.apparatus, [...MVP_APPARATUS])),

    // All rifle/pistol shooters for forma leaders (unfiltered, unpaginated)
    db
      .select({
        id:          shooters.id,
        firstName:   shooters.firstName,
        lastName:    shooters.lastName,
        apparatus:   shooters.apparatus,
        gender:      shooters.gender,
        avatarUrl:   shooters.avatarUrl,
        nationality: shooters.nationality,
        clubName:    clubs.name,
      })
      .from(shooters)
      .leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .where(inArray(shooters.apparatus, ["rifle", "pistol"])),
  ]);

  // Forma scores — paginated table + all-shooter leaders in parallel
  const shooterIds           = data.map((s) => s.id);
  const allFormaShooterIds   = allFormaShooters.map((s) => s.id);

  const [recentResultsData, formaLeaderResults] = await Promise.all([
    shooterIds.length > 0
      ? db
          .select({ shooterId: results.shooterId, qualTotal: results.qualTotal })
          .from(results)
          .innerJoin(competitions, eq(results.competitionId, competitions.id))
          .where(and(inArray(results.shooterId, shooterIds), isNotNull(results.qualTotal)))
          .orderBy(asc(results.shooterId), desc(competitions.date))
      : ([] as { shooterId: number; qualTotal: unknown }[]),

    allFormaShooterIds.length > 0
      ? db
          .select({ shooterId: results.shooterId, qualTotal: results.qualTotal })
          .from(results)
          .innerJoin(competitions, eq(results.competitionId, competitions.id))
          .where(and(inArray(results.shooterId, allFormaShooterIds), isNotNull(results.qualTotal)))
          .orderBy(asc(results.shooterId), desc(competitions.date))
      : ([] as { shooterId: number; qualTotal: unknown }[]),
  ]);

  // Group last 10 results per shooter and compute forma
  const scoresByShooter: Record<number, number[]> = {};
  for (const r of recentResultsData) {
    const id = r.shooterId;
    if (!scoresByShooter[id]) scoresByShooter[id] = [];
    if (scoresByShooter[id].length < 10) {
      scoresByShooter[id].push(Number(r.qualTotal));
    }
  }

  const enrichedData = data.map((s) => {
    const scores = scoresByShooter[s.id] ?? [];
    const { forma, trend } = computeFormaAndTrend(scores);
    return { ...s, forma, trend, resultCount: scores.length };
  });

  // Forma leaders across all shooters
  const allScoresByShooter: Record<number, number[]> = {};
  for (const r of formaLeaderResults) {
    const id = r.shooterId;
    if (!allScoresByShooter[id]) allScoresByShooter[id] = [];
    if (allScoresByShooter[id].length < 10) {
      allScoresByShooter[id].push(Number(r.qualTotal));
    }
  }

  type FormaLeader = typeof allFormaShooters[0] & { forma: number; trend: "up" | "down" | "stable" };
  const rifleLeaders: FormaLeader[]  = [];
  const pistolLeaders: FormaLeader[] = [];

  for (const s of allFormaShooters) {
    const scores = allScoresByShooter[s.id] ?? [];
    if (scores.length === 0) continue;
    const { forma, trend } = computeFormaAndTrend(scores);
    if (forma === null) continue;
    const entry = { ...s, forma, trend };
    if (s.apparatus === "rifle")  rifleLeaders.push(entry);
    else if (s.apparatus === "pistol") pistolLeaders.push(entry);
  }
  rifleLeaders.sort((a, b)  => b.forma - a.forma);
  pistolLeaders.sort((a, b) => b.forma - a.forma);
  const top3Rifle  = rifleLeaders.slice(0, 3);
  const top3Pistol = pistolLeaders.slice(0, 3);

  const totalPages    = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const availableNocs = nocRows.map((r) => r.noc).filter(Boolean) as string[];

  // Stats bar
  const activeCount    = statsActiveRows.length;
  const puskaCount     = statsApparatus.find((r) => r.apparatus === "rifle")?.count   ?? 0;
  const pistolijCount  = statsApparatus.find((r) => r.apparatus === "pistol")?.count  ?? 0;

  function sortUrl(col: SortCol) {
    const p = new URLSearchParams();
    if (activeQ)      p.set("q",      activeQ);
    if (activeZemlja) p.set("zemlja", activeZemlja);
    if (activePol)    p.set("pol",    activePol);
    if (activeAparat) p.set("aparat", activeAparat);
    p.set("sort", col);
    p.set("dir", activeSort === col && activeDir === "asc" ? "desc" : "asc");
    return `/strelci?${p.toString()}`;
  }

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (activeQ)      params.set("q",      activeQ);
    if (activeZemlja) params.set("zemlja", activeZemlja);
    if (activePol)    params.set("pol",    activePol);
    if (activeAparat) params.set("aparat", activeAparat);
    if (activeSort !== "name") params.set("sort", activeSort);
    if (activeDir  !== "asc")  params.set("dir",  activeDir);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/strelci?${qs}` : "/strelci";
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (activeSort !== col) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{activeDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">

      {/* ── Header ── */}
      <div className="mb-5">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.025em", lineHeight: 1.05 }}
        >
          Strelci
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Profili strelaca sa istorijom nastupa i forma score-om.
        </p>
      </div>

      {/* ── Stats bar ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-6 text-[0.8125rem] text-[var(--muted)]">
        <span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)]">
            {totalAll}
          </span>{" "}strelaca ukupno
        </span>
        <span className="text-[var(--border-strong)] hidden sm:inline" aria-hidden="true">·</span>
        <span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)]">
            {activeCount}
          </span>{" "}aktivnih {thisYear}.
        </span>
        <span className="text-[var(--border-strong)] hidden sm:inline" aria-hidden="true">·</span>
        <span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)]">
            {puskaCount}
          </span>{" "}puška
        </span>
        <span className="text-[var(--border-strong)] hidden sm:inline" aria-hidden="true">·</span>
        <span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)]">
            {pistolijCount}
          </span>{" "}pištolj
        </span>
      </div>

      {/* ── Forma leaders ── */}
      {(() => {
        const isDummy  = top3Rifle.length === 0 && top3Pistol.length === 0;
        const showRifle  = isDummy ? DUMMY_RIFLE  : top3Rifle;
        const showPistol = isDummy ? DUMMY_PISTOL : top3Pistol;
        return (
          <section
            aria-label="Strelci na vrhu forme"
            className="mb-8 bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden"
          >
            {isDummy && (
              <div className="px-5 pt-3 pb-0 flex items-center gap-2">
                <span className="text-[0.6rem] font-[family-name:var(--font-jetbrains-mono)] font-bold uppercase tracking-widest text-[var(--muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded">
                  preview · forma score uskoro
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">

              {/* Puška */}
              <div className={isDummy ? "p-5 opacity-50 pointer-events-none select-none" : "p-5"}>
                <div className="flex items-baseline gap-2 mb-4">
                  <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-[1.05rem] tracking-tight text-[var(--ink)] leading-none">
                    Puška
                  </h2>
                  <span className="text-[0.65rem] text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)]">
                    na vrhu forme
                  </span>
                </div>
                <div>
                  {showRifle.map((s, i) => (
                    <FormaLeaderRow key={s.id} s={s} rank={i + 1} isDummy={isDummy} />
                  ))}
                </div>
              </div>

              {/* Pištolj */}
              <div className={isDummy ? "p-5 opacity-50 pointer-events-none select-none" : "p-5"}>
                <div className="flex items-baseline gap-2 mb-4">
                  <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-[1.05rem] tracking-tight text-[var(--ink)] leading-none">
                    Pištolj
                  </h2>
                  <span className="text-[0.65rem] text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)]">
                    na vrhu forme
                  </span>
                </div>
                <div>
                  {showPistol.map((s, i) => (
                    <FormaLeaderRow key={s.id} s={s} rank={i + 1} isDummy={isDummy} />
                  ))}
                </div>
              </div>

            </div>
          </section>
        );
      })()}

      {/* ── Filter bar ── */}
      <Suspense fallback={<div className="h-20 rounded-lg bg-[var(--surface)] mb-6 animate-pulse" />}>
        <StrelciFilterBar
          availableNocs={availableNocs}
          currentQ={activeQ}
          currentZemlja={activeZemlja}
          currentPol={activePol}
          currentAparat={activeAparat}
          totalCount={totalCount}
          shownCount={data.length}
          page={page}
          totalPages={totalPages}
        />
      </Suspense>

      {/* ── Table ── */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {enrichedData.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-[var(--muted)]">
              {totalCount === 0
                ? "Nema strelaca za izabrane filtere."
                : "Nema rezultata na ovoj strani."}
            </p>
            {(activeQ || activeZemlja || activePol || activeAparat) && (
              <Link
                href="/strelci"
                className="mt-3 inline-block text-xs font-semibold text-[var(--brand-primary)] hover:underline"
              >
                Resetuj filtere
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[520px]">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <th scope="col" className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] w-2/5">
                    <Link href={sortUrl("name")} className="inline-flex items-center hover:text-[var(--ink)] transition-colors">
                      Strelac<SortIcon col="name" />
                    </Link>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] hidden md:table-cell">
                    <Link href={sortUrl("godiste")} className="inline-flex items-center justify-end hover:text-[var(--ink)] transition-colors">
                      Godište<SortIcon col="godiste" />
                    </Link>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    <Link href={sortUrl("disc")} className="inline-flex items-center hover:text-[var(--ink)] transition-colors">
                      Disc.<SortIcon col="disc" />
                    </Link>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Forma
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] hidden sm:table-cell">
                    Nastupa
                  </th>
                  <th scope="col" className="px-3 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {enrichedData.map((s) => {
                  const alpha2  = s.nationality
                    ? NOC_LIST.find((n) => n.noc === s.nationality)?.alpha2
                    : undefined;
                  const disc    = getDiscCode(s.apparatus, s.gender);
                  const discSty = disc ? DISC_STYLE[disc] : null;


                  return (
                    <tr
                      key={s.id}
                      className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] transition-colors group"
                    >
                      {/* Name + club + nationality inline */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {/* Avatar / initials */}
                          <div className="shrink-0 w-7 h-7 rounded-full overflow-hidden bg-[var(--surface-2)] flex items-center justify-center">
                            {s.avatarUrl ? (
                              <Image
                                src={s.avatarUrl}
                                alt=""
                                width={28}
                                height={28}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[0.6rem] font-bold text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)] leading-none select-none">
                                {s.firstName[0]}{s.lastName[0]}
                              </span>
                            )}
                          </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Link
                            href={`/strelci/${s.id}`}
                            className="font-semibold text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors leading-snug truncate"
                          >
                            {s.lastName} {s.firstName}
                          </Link>
                          {s.nationality && (
                            <span className="inline-flex items-center gap-1 shrink-0">
                              {alpha2 && (
                                <span
                                  className={`fi fi-${alpha2.toLowerCase()}`}
                                  style={{ width: "16px", height: "12px", borderRadius: "2px", display: "inline-block", flexShrink: 0 }}
                                />
                              )}
                              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold text-[var(--muted)]">
                                {s.nationality}
                              </span>
                            </span>
                          )}
                        </div>
                        {s.clubName && (
                          <div className="text-xs text-[var(--muted)] mt-0.5 truncate max-w-[200px] leading-none">
                            {s.clubName}
                            {s.clubCity && (
                              <span className="text-[var(--subtle)] ml-1">{s.clubCity}</span>
                            )}
                          </div>
                        )}
                        </div>
                      </td>

                      {/* Godište */}
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        {s.birthYear ? (
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm tabular-nums text-[var(--ink)]">
                            {s.birthYear}
                            <span className="text-[var(--muted)] ml-1 text-xs">
                              ({new Date().getFullYear() - s.birthYear})
                            </span>
                          </span>
                        ) : (
                          <span className="text-[var(--subtle)]">—</span>
                        )}
                      </td>

                      {/* Discipline badge */}
                      <td className="px-4 py-3">
                        {disc && discSty ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold leading-none whitespace-nowrap bg-[var(--surface-2)] text-[var(--muted)]">
                            {discSty.label}
                          </span>
                        ) : (
                          <span className="text-[var(--subtle)]">—</span>
                        )}
                      </td>

                      {/* Forma + trend */}
                      <td className="px-4 py-3 text-right">
                        {s.forma !== null ? (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <span className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)] tabular-nums text-sm">
                              {s.forma.toFixed(1)}
                            </span>
                            <span
                              className="text-xs font-bold leading-none w-3 text-center"
                              style={{
                                color:
                                  s.trend === "up"
                                    ? "var(--success)"
                                    : s.trend === "down"
                                    ? "var(--brand-primary)"
                                    : "var(--subtle)",
                              }}
                              aria-label={
                                s.trend === "up" ? "u porastu" : s.trend === "down" ? "u padu" : "stabilno"
                              }
                            >
                              {s.trend === "up" ? "↑" : s.trend === "down" ? "↓" : "→"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] text-sm">
                            —
                          </span>
                        )}
                      </td>

                      {/* Result count */}
                      <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] text-sm tabular-nums hidden sm:table-cell">
                        {s.resultCount > 0 ? (
                          s.resultCount
                        ) : (
                          <span className="text-[var(--subtle)]">—</span>
                        )}
                      </td>

                      {/* Chevron */}
                      <td className="px-3 py-3">
                        <svg
                          width="12" height="12" viewBox="0 0 12 12"
                          className="text-[var(--border-strong)] group-hover:text-[var(--muted)] transition-colors"
                          aria-hidden="true"
                        >
                          <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1">
          <Link
            href={pageUrl(page - 1)}
            aria-disabled={page <= 1}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${page <= 1 ? "pointer-events-none opacity-30 text-[var(--muted)]" : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"}`}
          >
            ← Prethodna
          </Link>
          <span className="text-xs text-[var(--muted)] px-3 font-[family-name:var(--font-jetbrains-mono)]">
            {page} / {totalPages}
          </span>
          <Link
            href={pageUrl(page + 1)}
            aria-disabled={page >= totalPages}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${page >= totalPages ? "pointer-events-none opacity-30 text-[var(--muted)]" : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"}`}
          >
            Sledeća →
          </Link>
        </div>
      )}

    </main>
  );
}
