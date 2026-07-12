export const revalidate = 300;

import { Suspense } from "react";
import { ScopedLink } from "../../components/ScopedLink";
import Image from "next/image";
import { db } from "@/lib/db";
import { shooters, clubs, results, competitions } from "@/lib/db/schema";
import { eq, asc, ilike, or, and, isNotNull, inArray, sql, desc, gte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { NOC_LIST } from "@/lib/noc-list";
import { MVP_APPARATUS } from "@/lib/mvp-scope";
import { computeFormaFromEntries, type CompetitionLevel } from "@/lib/forma";
import { StrelciFilterBar } from "./StrelciFilterBar";
import { getLocale, getTranslations } from "next-intl/server";
import { CATEGORY_LABEL, computeAgeCategoryFromBirthYear } from "@/lib/pdf-import/types";
import { buildAlternates } from "@/i18n/alternates";
import type { Metadata } from "next";
import { buildShooterScopeFilter, type Scope } from "@/lib/scope";

export async function generateMetadata({ params }: { params: Promise<{ scope: Scope }> }): Promise<Metadata> {
  const { scope } = await params;
  const [t, locale] = await Promise.all([getTranslations("shooters"), getLocale()]);
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: buildAlternates(locale, scope, "/strelci"),
  };
}

const PAGE_SIZE = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDiscCode(apparatus: string | null, gender: string | null): string | null {
  const isRifle  = apparatus === "rifle"  || apparatus === "air_rifle";
  const isPistol = apparatus === "pistol" || apparatus === "air_pistol";
  if (isRifle)  return gender === "F" ? "ARW" : "ARM";
  if (isPistol) return gender === "F" ? "APW" : "APM";
  return null;
}

type FormaEntryRow = { qualTotal: number; date: string; level: CompetitionLevel | null };

// computeFormaFromEntries sortira hronološki interno — redosled ulaza nebitan.
function formaFromEntries(entries: FormaEntryRow[], code?: string): {
  forma: number | null;
  trend: "up" | "down" | "stable";
} {
  const r = computeFormaFromEntries(entries, { code });
  return { forma: r.forma, trend: r.trend };
}

type FormaEntry = {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  clubName: string | null;
  forma: number;
  trend: "up" | "down" | "stable";
};

// ── Forma Leader Row ─────────────────────────────────────────────────────────

function FormaLeaderRow({
  s,
  rank,
  t,
}: {
  s: FormaEntry;
  rank: number;
  t: any;
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
          aria-label={s.trend === "up" ? t("trendUp") : s.trend === "down" ? t("trendDown") : t("trendStable")}
        >
          {s.trend === "up" ? "↑" : s.trend === "down" ? "↓" : "→"}
        </span>
      </div>
    </>
  );

  const rowClass = "flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg transition-colors group border-b border-[var(--border)] last:border-0";

  return (
    <ScopedLink href={`/strelci/${s.id}`} className={`${rowClass} hover:bg-[var(--surface-2)]`}>
      {inner}
    </ScopedLink>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type SortCol = "name" | "godiste" | "disc";
type SortDir = "asc" | "desc";

type Props = {
  params: Promise<{ scope: Scope }>;
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

export default async function StrelciPage({ params, searchParams }: Props) {
  const { scope } = await params;
  const locale       = await getLocale();
  const t            = await getTranslations("shooters");
  const tProfile     = await getTranslations("shooters.profile");

  const DISC_STYLE: Record<string, { label: string }> = {
    ARM: { label: locale === "en" ? "Rifle Men" : "Puška M" },
    ARW: { label: locale === "en" ? "Rifle Women" : "Puška Ž" },
    APM: { label: locale === "en" ? "Pistol Men" : "Pištolj M" },
    APW: { label: locale === "en" ? "Pistol Women" : "Pištolj Ž" },
  };

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
  const scopeFilter  = buildShooterScopeFilter(scope);

  const conditions: (SQL | undefined)[] = [
    inArray(shooters.apparatus, [...MVP_APPARATUS]),
    scopeFilter,
    activeQ
      ? and(
          ...activeQ
            .split(/\s+/)
            .filter(Boolean)
            .map((word) =>
              or(ilike(shooters.firstName, `%${word}%`), ilike(shooters.lastName, `%${word}%`))
            )
        )
      : undefined,
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
      .where(and(isNotNull(shooters.nationality), scopeFilter))
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
        scopeFilter,
      )),

    // Breakdown by apparatus (global, unfiltered)
    db
      .select({ apparatus: shooters.apparatus, count: sql<number>`COUNT(*)::int` })
      .from(shooters)
      .where(and(inArray(shooters.apparatus, [...MVP_APPARATUS]), scopeFilter))
      .groupBy(shooters.apparatus),

    // Total shooters in MVP scope (unfiltered)
    db
      .select({ totalAll: sql<number>`COUNT(*)::int` })
      .from(shooters)
      .where(and(inArray(shooters.apparatus, [...MVP_APPARATUS]), scopeFilter)),

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
      .where(and(inArray(shooters.apparatus, [...MVP_APPARATUS]), scopeFilter)),
  ]);

  // Forma scores — paginated table + all-shooter leaders in parallel
  const shooterIds           = data.map((s) => s.id);
  const allFormaShooterIds   = allFormaShooters.map((s) => s.id);

  const [recentResultsData, formaLeaderResults] = await Promise.all([
    shooterIds.length > 0
      ? db
          .select({ shooterId: results.shooterId, qualTotal: results.qualTotal, date: competitions.date, level: competitions.level })
          .from(results)
          .innerJoin(competitions, eq(results.competitionId, competitions.id))
          .where(and(inArray(results.shooterId, shooterIds), isNotNull(results.qualTotal)))
          .orderBy(asc(results.shooterId), desc(competitions.date))
      : ([] as { shooterId: number; qualTotal: unknown; date: string; level: CompetitionLevel }[]),

    allFormaShooterIds.length > 0
      ? db
          .select({ shooterId: results.shooterId, qualTotal: results.qualTotal, date: competitions.date, level: competitions.level })
          .from(results)
          .innerJoin(competitions, eq(results.competitionId, competitions.id))
          .where(and(inArray(results.shooterId, allFormaShooterIds), isNotNull(results.qualTotal)))
          .orderBy(asc(results.shooterId), desc(competitions.date))
      : ([] as { shooterId: number; qualTotal: unknown; date: string; level: CompetitionLevel }[]),
  ]);

  // Group recent results per shooter (newest-first) and compute forma.
  // Cap = WINDOW (computeForma ionako uzima prozor); 20 da aktivni strelci imaju dovoljno.
  const FORMA_CAP = 20;
  const entriesByShooter: Record<number, FormaEntryRow[]> = {};
  for (const r of recentResultsData) {
    const id = r.shooterId;
    if (!entriesByShooter[id]) entriesByShooter[id] = [];
    if (entriesByShooter[id].length < FORMA_CAP) {
      entriesByShooter[id].push({ qualTotal: Number(r.qualTotal), date: r.date, level: r.level });
    }
  }

  const enrichedData = data.map((s) => {
    const entries = entriesByShooter[s.id] ?? [];
    const code = getDiscCode(s.apparatus, s.gender) ?? undefined;
    const { forma, trend } = formaFromEntries(entries, code);
    return { ...s, forma, trend, resultCount: entries.length };
  });

  // Forma leaders across all shooters
  const allEntriesByShooter: Record<number, FormaEntryRow[]> = {};
  for (const r of formaLeaderResults) {
    const id = r.shooterId;
    if (!allEntriesByShooter[id]) allEntriesByShooter[id] = [];
    if (allEntriesByShooter[id].length < FORMA_CAP) {
      allEntriesByShooter[id].push({ qualTotal: Number(r.qualTotal), date: r.date, level: r.level });
    }
  }

  type FormaLeader = typeof allFormaShooters[0] & { forma: number; trend: "up" | "down" | "stable" };
  const leadersByDisc: Record<string, FormaLeader[]> = { ARM: [], ARW: [], APM: [], APW: [] };

  for (const s of allFormaShooters) {
    const entries = allEntriesByShooter[s.id] ?? [];
    if (entries.length === 0) continue;
    const disc = getDiscCode(s.apparatus, s.gender);
    const { forma, trend } = formaFromEntries(entries, disc ?? undefined);
    if (forma === null) continue;
    if (disc && disc in leadersByDisc) {
      leadersByDisc[disc].push({ ...s, forma, trend });
    }
  }
  for (const arr of Object.values(leadersByDisc)) arr.sort((a, b) => b.forma - a.forma);
  const top3ByDisc: Record<string, FormaLeader[]> = Object.fromEntries(
    Object.entries(leadersByDisc).map(([k, v]) => [k, v.slice(0, 3)])
  );

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
          {t("title")}
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* ── Stats bar ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-6 text-[0.8125rem] text-[var(--muted)]">
        <span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)]">
            {totalAll}
          </span>{" "}{t("totalCount")}
        </span>
        <span className="text-[var(--border-strong)] hidden sm:inline" aria-hidden="true">·</span>
        <span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)]">
            {activeCount}
          </span>{" "}{t("activeThisYear")} {thisYear}.
        </span>
        <span className="text-[var(--border-strong)] hidden sm:inline" aria-hidden="true">·</span>
        <span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)]">
            {puskaCount}
          </span>{" "}{t("statRifle")}
        </span>
        <span className="text-[var(--border-strong)] hidden sm:inline" aria-hidden="true">·</span>
        <span>
          <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)]">
            {pistolijCount}
          </span>{" "}{t("statPistol")}
        </span>
      </div>

      {/* ── Forma leaders ── */}
      {(() => {
        const show = top3ByDisc as Record<string, FormaEntry[]>;
        const hasAny = ["ARM","ARW","APM","APW"].some((d) => (show[d]?.length ?? 0) > 0);
        if (!hasAny) return null;

        function DiscPanel({ code }: { code: string }) {
          const isMen = code === "ARM" || code === "APM";
          const rows = show[code] ?? [];
          if (rows.length === 0) return null;
          return (
            <div className="p-5">
              <div className="flex items-baseline gap-2 mb-4">
                <h3 className="font-[family-name:var(--font-barlow-condensed)] font-bold uppercase text-[1.05rem] tracking-tight text-[var(--ink)] leading-none">
                  {t(isMen ? "discMen" : "discWomen")}
                </h3>
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[0.6rem] font-bold uppercase tracking-widest text-[var(--subtle)] shrink-0">
                  {code}
                </span>
                <span className="text-[0.65rem] text-[var(--muted)] font-[family-name:var(--font-jetbrains-mono)] ml-auto shrink-0">
                  {t("onTopForm")}
                </span>
              </div>
              <div>
                {rows.map((s, i) => (
                  <FormaLeaderRow key={s.id} s={s} rank={i + 1} t={t} />
                ))}
              </div>
            </div>
          );
        }

        const hasRifle  = (show.ARM?.length ?? 0) > 0 || (show.ARW?.length ?? 0) > 0;
        const hasPistol = (show.APM?.length ?? 0) > 0 || (show.APW?.length ?? 0) > 0;

        return (
          <section
            aria-label="Strelci na vrhu forme"
            className="mb-8 bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden"
          >
            {/* Rifle row */}
            {hasRifle && (
              <div>
                <div className="px-5 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border)]">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t("discGroupRifle")}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
                  <DiscPanel code="ARM" />
                  <DiscPanel code="ARW" />
                </div>
              </div>
            )}

            {/* Pistol row */}
            {hasPistol && (
              <div className={hasRifle ? "border-t border-[var(--border)]" : undefined}>
                <div className="px-5 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border)]">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {t("discGroupPistol")}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
                  <DiscPanel code="APM" />
                  <DiscPanel code="APW" />
                </div>
              </div>
            )}

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
                ? t("noResults")
                : t("noResultsPage")}
            </p>
            {(activeQ || activeZemlja || activePol || activeAparat) && (
              <ScopedLink
                href="/strelci"
                className="mt-3 inline-block text-xs font-semibold text-[var(--brand-primary)] hover:underline"
              >
                {t("resetFilters")}
              </ScopedLink>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[520px]">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <th scope="col" className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] w-2/5">
                    <ScopedLink href={sortUrl("name")} className="inline-flex items-center hover:text-[var(--ink)] transition-colors">
                      {tProfile("shooter")}<SortIcon col="name" />
                    </ScopedLink>
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] hidden md:table-cell">
                    <ScopedLink href={sortUrl("godiste")} className="inline-flex items-center justify-end hover:text-[var(--ink)] transition-colors">
                      {tProfile("birthYear")}<SortIcon col="godiste" />
                    </ScopedLink>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    <ScopedLink href={sortUrl("disc")} className="inline-flex items-center hover:text-[var(--ink)] transition-colors">
                      {tProfile("discipline")}<SortIcon col="disc" />
                    </ScopedLink>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] hidden sm:table-cell">
                    {locale === "en" ? "Category" : "Kategorija"}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {tProfile("form")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] hidden sm:table-cell">
                    {tProfile("competitions")}
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
                  const currentCategory = s.birthYear ? computeAgeCategoryFromBirthYear(s.birthYear) : null;


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
                          <ScopedLink
                            href={`/strelci/${s.id}`}
                            className="font-semibold text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors leading-snug truncate"
                          >
                            {s.lastName} {s.firstName}
                          </ScopedLink>
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

                      {/* Uzrasna kategorija */}
                      <td className="px-4 py-3 text-xs font-semibold text-[var(--muted)] hidden sm:table-cell">
                        {currentCategory ? (
                          CATEGORY_LABEL[currentCategory]
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
                                s.trend === "up" ? t("trendUp") : s.trend === "down" ? t("trendDown") : t("trendStable")
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
          <ScopedLink
            href={pageUrl(page - 1)}
            aria-disabled={page <= 1}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${page <= 1 ? "pointer-events-none opacity-30 text-[var(--muted)]" : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"}`}
          >
            {locale === "en" ? "← Previous" : "← Prethodna"}
          </ScopedLink>
          <span className="text-xs text-[var(--muted)] px-3 font-[family-name:var(--font-jetbrains-mono)]">
            {page} / {totalPages}
          </span>
          <ScopedLink
            href={pageUrl(page + 1)}
            aria-disabled={page >= totalPages}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${page >= totalPages ? "pointer-events-none opacity-30 text-[var(--muted)]" : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"}`}
          >
            {locale === "en" ? "Next →" : "Sledeća →"}
          </ScopedLink>
        </div>
      )}

    </main>
  );
}
