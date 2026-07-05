export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { shooters, clubs, results, disciplines, competitions } from "@/lib/db/schema";
import { eq, isNotNull, and, inArray, asc } from "drizzle-orm";
import { MVP_APPARATUS } from "@/lib/mvp-scope";
import Link from "next/link";
import type { Metadata } from "next";
import { computeFormaScore, trendLabel, trendColor } from "@/lib/forma-score";
import { NOC_LIST } from "@/lib/noc-list";

export const metadata: Metadata = { title: "Rangiranje" };

// ── Constants ─────────────────────────────────────────────────────────────────

type DiscCode = "ARM" | "ARW" | "APM" | "APW";

const TABS: { code: DiscCode; label: string }[] = [
  { code: "ARM", label: "10m puška M" },
  { code: "ARW", label: "10m puška Ž" },
  { code: "APM", label: "10m pištolj M" },
  { code: "APW", label: "10m pištolj Ž" },
];

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

type Props = { searchParams: Promise<{ disciplina?: string; zemlja?: string }> };

export default async function RangiranjeePage({ searchParams }: Props) {
  const { disciplina, zemlja } = await searchParams;

  const validCode = TABS.find((t) => t.code === disciplina?.toUpperCase())?.code;
  const activeCode: DiscCode = validCode ?? "ARM";
  const activeZemlja = zemlja?.toUpperCase() ?? null;

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
          qualTotal: results.qualTotal,
          qualInners: results.qualInners,
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
          )
        )
        .orderBy(asc(competitions.date))
    : [];

  const maxScore = discipline ? parseFloat(discipline.maxQualScore) : 600;
  const isAP = activeCode.startsWith("AP");

  // Unique NOCs for country filter
  const allNocs = Array.from(
    new Set(rawResults.map((r) => r.nationality).filter(Boolean) as string[])
  ).sort();

  // Group by shooter
  type ShooterEntry = {
    firstName: string;
    lastName: string;
    nationality: string | null;
    clubName: string | null;
    entries: { qualTotal: number; date: string }[];
    bestInners: number | null;
  };

  const shooterMap = new Map<number, ShooterEntry>();

  for (const r of rawResults) {
    if (!shooterMap.has(r.shooterId)) {
      shooterMap.set(r.shooterId, {
        firstName: r.firstName,
        lastName: r.lastName,
        nationality: r.nationality,
        clubName: r.clubName,
        entries: [],
        bestInners: null,
      });
    }
    const entry = shooterMap.get(r.shooterId)!;
    if (r.qualTotal != null) {
      entry.entries.push({ qualTotal: parseFloat(r.qualTotal), date: r.competitionDate });
    }
    if (r.qualInners != null && (entry.bestInners === null || r.qualInners > entry.bestInners)) {
      entry.bestInners = r.qualInners;
    }
  }

  const allRanked = Array.from(shooterMap.entries())
    .map(([shooterId, data]) => ({
      shooterId,
      ...data,
      forma: computeFormaScore(data.entries, maxScore),
      peak: data.entries.length > 0 ? Math.max(...data.entries.map((e) => e.qualTotal)) : null,
    }))
    .sort((a, b) => {
      const fa = a.forma?.score ?? 0;
      const fb = b.forma?.score ?? 0;
      if (fb !== fa) return fb - fa;
      return (b.peak ?? 0) - (a.peak ?? 0);
    });

  const displayed = activeZemlja
    ? allRanked.filter((s) => s.nationality === activeZemlja)
    : allRanked;

  const activeTab = TABS.find((t) => t.code === activeCode)!;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">

      {/* Header */}
      <div className="mb-6">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.025em", lineHeight: 1.05 }}
        >
          Rangiranje
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Poredak po forma score-u — weighted average poslednjih nastupa
        </p>
      </div>

      {/* Discipline tabs */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {TABS.map(({ code, label }) => {
          const active = activeCode === code;
          return (
            <Link
              key={code}
              href={`/rangiranje?disciplina=${code.toLowerCase()}${activeZemlja ? `&zemlja=${activeZemlja}` : ""}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors no-underline"
              style={
                active
                  ? { background: "var(--ink)", color: "var(--bg)" }
                  : { background: "var(--surface-2)", color: "var(--muted)" }
              }
            >
              <span className="font-[family-name:var(--font-jetbrains-mono)] font-bold">{code}</span>
              <span className="hidden sm:inline font-normal">{label}</span>
            </Link>
          );
        })}
      </div>

      {/* Country filter */}
      {allNocs.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 mb-5">
          <Link
            href={`/rangiranje?disciplina=${activeCode.toLowerCase()}`}
            className="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors no-underline font-[family-name:var(--font-jetbrains-mono)]"
            style={
              !activeZemlja
                ? { background: "var(--ink)", color: "var(--bg)" }
                : { background: "var(--surface-2)", color: "var(--muted)" }
            }
          >
            Sve
          </Link>
          {allNocs.map((noc) => {
            const a2 = nocAlpha2(noc);
            const active = activeZemlja === noc;
            return (
              <Link
                key={noc}
                href={`/rangiranje?disciplina=${activeCode.toLowerCase()}&zemlja=${noc}`}
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

      {/* Empty state */}
      {displayed.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] py-20 text-center">
          <p className="text-sm text-[var(--muted)]">
            Nema podataka za {activeTab.label}
            {activeZemlja ? ` · ${activeZemlja}` : ""}.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <th className={`${TH} text-right w-12`}>#</th>
                <th className={`${TH} text-left`}>Strelac</th>
                <th className={`${TH} text-left hidden md:table-cell`}>Zemlja</th>
                <th className={`${TH} text-left hidden lg:table-cell`}>Klub</th>
                <th className={`${TH} text-right`}>Forma</th>
                <th className={`${TH} text-right hidden sm:table-cell`}>Peak</th>
                {isAP && (
                  <th className={`${TH} text-right hidden sm:table-cell`}>Inn.</th>
                )}
                <th className={`${TH} text-right hidden md:table-cell`}>Nast.</th>
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

                    {/* Forma — primary metric */}
                    <td className="px-4 py-3 text-right">
                      {s.forma ? (
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <span
                            className="font-[family-name:var(--font-jetbrains-mono)] font-bold tabular-nums text-[var(--ink)]"
                            style={{ fontSize: isTop3 ? "1rem" : "0.875rem" }}
                          >
                            {s.forma.score.toFixed(1)}
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
                      )}
                    </td>

                    {/* Peak */}
                    <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm text-[var(--muted)] tabular-nums hidden sm:table-cell">
                      {s.peak ?? <span className="text-[var(--subtle)]">—</span>}
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
                      {s.entries.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer count */}
          <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)]">
              {displayed.length} strelaca · {activeTab.label}
              {activeZemlja ? ` · ${activeZemlja}` : ""}
            </span>
            <span className="text-xs text-[var(--subtle)]">
              Forma score = weighted avg poslednjih 10 nastupa
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
