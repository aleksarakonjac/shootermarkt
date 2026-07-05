export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { shooters, clubs, results, disciplines, competitions } from "@/lib/db/schema";
import { eq, isNotNull, and, asc } from "drizzle-orm";
import Link from "next/link";
import { computeFormaScore, trendLabel, trendColor } from "@/lib/forma-score";

export const metadata = { title: "Rangiranje" };

type DisciplineCode = "ARM" | "ARW" | "APM" | "APW";

const TABS: { code: DisciplineCode; name: string }[] = [
  { code: "ARM", name: "Air Rifle Men" },
  { code: "ARW", name: "Air Rifle Women" },
  { code: "APM", name: "Air Pistol Men" },
  { code: "APW", name: "Air Pistol Women" },
];

type Props = { searchParams: Promise<{ disciplina?: string; zemlja?: string }> };

export default async function RangiranjeePage({ searchParams }: Props) {
  const { disciplina, zemlja } = await searchParams;
  const activeCode = (disciplina?.toUpperCase() ?? "ARM") as DisciplineCode;
  const activeZemlja = zemlja?.toUpperCase() ?? null;

  const discipline = await db.query.disciplines.findFirst({
    where: eq(disciplines.code, activeCode as "ARM" | "ARW" | "APM" | "APW"),
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
        .where(and(eq(results.disciplineId, discipline.id), isNotNull(results.qualTotal)))
        .orderBy(asc(competitions.date))
    : [];

  const maxScore = discipline ? parseFloat(discipline.maxQualScore) : 600;

  // All unique countries present in this discipline's results
  const allNocs = Array.from(
    new Set(rawResults.map((r) => r.nationality).filter(Boolean) as string[])
  ).sort();

  // Group by shooter
  const shooterMap = new Map<
    number,
    { firstName: string; lastName: string; nationality: string | null; clubName: string | null; entries: { qualTotal: number; date: string }[] }
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
    if (r.qualTotal != null) {
      shooterMap.get(r.shooterId)!.entries.push({
        qualTotal: parseFloat(r.qualTotal),
        date: r.competitionDate,
      });
    }
  }

  const ranking = Array.from(shooterMap.entries())
    .map(([shooterId, data]) => {
      const forma = computeFormaScore(data.entries, maxScore);
      const peak = data.entries.length > 0 ? Math.max(...data.entries.map((e) => e.qualTotal)) : null;
      // Best inners for AP disciplines
      const bestInners = rawResults
        .filter((r) => r.shooterId === shooterId && r.qualInners != null)
        .reduce((best, r) => (r.qualInners! > (best ?? -1) ? r.qualInners! : best), null as number | null);
      return { shooterId, ...data, forma, peak, bestInners };
    })
    .filter((s) => s.forma !== null)
    .sort((a, b) => b.forma!.score - a.forma!.score);

  // Shooters with results but only 1 nastup (no forma trend) — append after
  const noForma = Array.from(shooterMap.entries())
    .filter(([id]) => !ranking.find((r) => r.shooterId === id))
    .map(([shooterId, data]) => ({
      shooterId,
      ...data,
      forma: null,
      peak: data.entries.length > 0 ? Math.max(...data.entries.map((e) => e.qualTotal)) : null,
      bestInners: null as number | null,
    }))
    .sort((a, b) => (b.peak ?? 0) - (a.peak ?? 0));

  const allRanked = [...ranking, ...noForma].filter(
    (s) => !activeZemlja || s.nationality === activeZemlja
  );
  const activeTab = TABS.find((t) => t.code === activeCode);
  const isAP = activeCode.startsWith("AP");
  const totalCount = [...ranking, ...noForma].length;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-[var(--border)]">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.02em" }}
        >
          Rangiranje
        </h1>
        <p className="text-sm mt-1 text-[var(--muted)]">
          Poredak po forma score-u — weighted average poslednjih nastupa
        </p>
      </div>

      {/* Discipline tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-[var(--surface)] w-fit">
        {TABS.map(({ code, name }) => {
          const active = activeCode === code;
          return (
            <Link
              key={code}
              href={`/rangiranje?disciplina=${code.toLowerCase()}`}
              className="flex flex-col items-center px-4 py-2 rounded-md text-center transition-colors duration-150 no-underline"
              style={{
                background: active ? "var(--bg)" : "transparent",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <span
                className="font-[family-name:var(--font-barlow-condensed)] font-bold text-base tracking-tight"
                style={{ color: active ? "var(--brand-primary)" : "var(--muted)" }}
              >
                {code}
              </span>
              <span
                className="text-[0.65rem] hidden sm:block leading-tight"
                style={{ color: active ? "var(--muted)" : "var(--subtle)" }}
              >
                {name}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Country filter */}
      {allNocs.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href={`/rangiranje?disciplina=${activeCode.toLowerCase()}`}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-colors no-underline"
            style={{
              background: !activeZemlja ? "var(--brand-primary)" : "var(--surface)",
              color: !activeZemlja ? "white" : "var(--ink)",
            }}
          >
            Sve ({totalCount})
          </Link>
          {allNocs.map((noc) => {
            const cnt = [...ranking, ...noForma].filter((s) => s.nationality === noc).length;
            return (
              <Link
                key={noc}
                href={`/rangiranje?disciplina=${activeCode.toLowerCase()}&zemlja=${noc}`}
                className="rounded-full px-3 py-1 text-xs font-[family-name:var(--font-jetbrains-mono)] font-semibold transition-colors no-underline"
                style={{
                  background: activeZemlja === noc ? "var(--brand-accent)" : "var(--surface)",
                  color: activeZemlja === noc ? "white" : "var(--ink)",
                }}
              >
                {noc} ({cnt})
              </Link>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {allRanked.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-[var(--muted)]">
              Nema podataka za {activeTab?.name ?? activeCode}
              {activeZemlja ? ` · ${activeZemlja}` : ""}.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th className="w-12 px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">#</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Strelac</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Klub</th>
                <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Forma</th>
                <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Peak</th>
                {isAP && (
                  <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Inners</th>
                )}
                <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Nastupa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {allRanked.map((s, i) => (
                <tr key={s.shooterId} className="hover:bg-[var(--surface)] transition-colors">
                  <td
                    className="w-12 px-4 py-3 text-right font-[family-name:var(--font-barlow-condensed)] font-bold text-lg"
                    style={{ color: i === 0 ? "var(--brand-primary)" : "var(--subtle)" }}
                  >
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/strelci/${s.shooterId}`}
                      className="font-semibold text-[var(--ink)] hover:underline"
                    >
                      {s.lastName} {s.firstName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {s.nationality ? (
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)]">
                        {s.nationality}
                      </span>
                    ) : (
                      <span className="text-[var(--subtle)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {s.clubName ?? <span className="text-[var(--subtle)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.forma ? (
                      <span className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)]">
                        {s.forma.score.toFixed(1)}
                        <span className="ml-1 text-xs" style={{ color: trendColor(s.forma.trend) }}>
                          {trendLabel(s.forma.trend)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--subtle)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)]">
                    {s.peak ?? <span className="text-[var(--subtle)]">—</span>}
                  </td>
                  {isAP && (
                    <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                      {s.bestInners != null ? `${s.bestInners}x` : <span className="text-[var(--subtle)]">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right text-xs text-[var(--subtle)]">
                    {s.entries.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
