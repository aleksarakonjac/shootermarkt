import { db } from "@/lib/db";
import { shooters, results, competitions, disciplines } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { computeFormaScore, trendLabel, trendColor } from "@/lib/forma-score";
import { ResultsHistoryTable } from "@/components/result-display/ResultsHistoryTable";
import { NOC_LIST } from "@/lib/noc-list";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const shooter = await db.query.shooters.findFirst({
    where: eq(shooters.id, parseInt(id)),
  });
  if (!shooter) return { title: "Strelac nije pronađen" };
  return { title: `${shooter.lastName} ${shooter.firstName}` };
}

export default async function ShooterPage({ params }: Props) {
  const { id } = await params;
  const shooterId = parseInt(id);
  if (isNaN(shooterId)) notFound();

  const shooter = await db.query.shooters.findFirst({
    where: eq(shooters.id, shooterId),
    with: { club: true },
  });
  if (!shooter) notFound();

  const [shooterResults, allDisciplines] = await Promise.all([
    db
      .select({
        id: results.id,
        qualTotal: results.qualTotal,
        qualRank: results.qualRank,
        qualInners: results.qualInners,
        qualified: results.qualified,
        finalTotal: results.finalTotal,
        finalRank: results.finalRank,
        qualDetail: results.qualDetail,
        finalDetail: results.finalDetail,
        competitionName: competitions.name,
        competitionDate: competitions.date,
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
    db.select().from(disciplines),
  ]);

  const formaByDisc = Object.fromEntries(
    allDisciplines.map((d) => {
      const discResults = shooterResults
        .filter((r) => r.disciplineId === d.id && r.qualTotal != null)
        .map((r) => ({ qualTotal: parseFloat(r.qualTotal!), date: r.competitionDate }));
      return [d.code, computeFormaScore(discResults, parseFloat(d.maxQualScore))];
    })
  );

  const hasForma = allDisciplines.some((d) => formaByDisc[d.code] !== null);
  const initials = `${shooter.firstName[0]}${shooter.lastName[0]}`;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-[var(--muted)] mb-8">
        <Link href="/strelci" className="hover:text-[var(--ink)] transition-colors">
          Strelci
        </Link>
        <span className="text-[var(--subtle)]">/</span>
        <span className="text-[var(--ink)] font-medium">
          {shooter.lastName} {shooter.firstName}
        </span>
      </nav>

      {/* Profile header */}
      <div className="flex items-start gap-5 mb-8 pb-8 border-b border-[var(--border)]">
        <div
          className="w-24 h-24 rounded-xl shrink-0 overflow-hidden flex items-center justify-center font-[family-name:var(--font-barlow-condensed)] font-bold text-2xl text-white"
          style={{ background: shooter.avatarUrl ? "transparent" : "var(--brand-primary)" }}
        >
          {shooter.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shooter.avatarUrl}
              alt={`${shooter.firstName} ${shooter.lastName}`}
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 flex-wrap">
            <h1
              className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
              style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", letterSpacing: "-0.02em" }}
            >
              {shooter.lastName} {shooter.firstName}
            </h1>
            {shooter.verified && (
              <span
                className="mt-1 inline-flex items-center gap-1 text-[0.7rem] font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{ background: "var(--brand-primary-light)", color: "var(--brand-primary)" }}
              >
                ✓ Verifikovan
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-[var(--muted)]">
            {shooter.nationality && (() => {
              const alpha2 = NOC_LIST.find((n) => n.noc === shooter.nationality)?.alpha2;
              return (
                <span className="flex items-center gap-1.5 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)] bg-[var(--surface-2)] px-2 py-0.5 rounded">
                  {alpha2 && <span className={`fi fi-${alpha2.toLowerCase()}`} style={{ fontSize: "1em", borderRadius: "2px" }} />}
                  {shooter.nationality}
                </span>
              );
            })()}
            {shooter.club && <span>{shooter.club.name}</span>}
            {(shooter.birthDate || shooter.birthYear) && (
              <span>
                Datum rođenja: {shooter.birthDate
                  ? shooter.birthDate.split("-").reverse().join(".")
                  : shooter.birthYear}
              </span>
            )}
            {shooter.gender && <span>{shooter.gender === "M" ? "Muški" : "Ženski"}</span>}
            {shooter.apparatus && (
              <span>{shooter.apparatus === "rifle" ? "Puška" : shooter.apparatus === "pistol" ? "Pištolj" : "Puška i pištolj"}</span>
            )}
          </div>
        </div>
      </div>

      {/* Forma score */}
      {hasForma && (
        <div className="mb-10">
          <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-tight text-[var(--ink)] mb-4">
            Forma score
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--border)] rounded-xl overflow-hidden border border-[var(--border)]">
            {allDisciplines.map((d) => {
              const forma = formaByDisc[d.code];
              return (
                <div key={d.code} className="bg-[var(--bg)] px-5 py-4">
                  <p className="text-xs font-semibold font-[family-name:var(--font-barlow-condensed)] text-[var(--muted)] uppercase tracking-wide mb-1">
                    {d.code}
                  </p>
                  {forma ? (
                    <>
                      <p className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-2xl leading-none tabular-nums text-[var(--ink)]">
                        {forma.score.toFixed(1)}
                        <span className="ml-1.5 text-base" style={{ color: trendColor(forma.trend) }}>
                          {trendLabel(forma.trend)}
                        </span>
                      </p>
                      <div className="flex gap-3 mt-2 text-xs text-[var(--subtle)]">
                        <span>
                          Peak{" "}
                          <span className="font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)]">
                            {forma.peak}
                          </span>
                        </span>
                        <span>{forma.resultsUsed} nastupa</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--subtle)]">—</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results history */}
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl uppercase tracking-tight text-[var(--ink)] mb-4">
          Istorija nastupa
        </h2>

        {shooterResults.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
            <p className="text-sm text-[var(--muted)]">Nema unešenih rezultata.</p>
          </div>
        ) : (
          <ResultsHistoryTable results={shooterResults} />
        )}
      </div>
    </div>
  );
}
