import { db } from "@/lib/db";
import { shooters, clubs, results, competitions, disciplines } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

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

  const shooterResults = await db
    .select({
      id: results.id,
      qualTotal: results.qualTotal,
      qualRank: results.qualRank,
      qualified: results.qualified,
      finalTotal: results.finalTotal,
      finalRank: results.finalRank,
      competitionName: competitions.name,
      competitionDate: competitions.date,
      competitionLevel: competitions.level,
      disciplineCode: disciplines.code,
      disciplineName: disciplines.name,
    })
    .from(results)
    .innerJoin(competitions, eq(results.competitionId, competitions.id))
    .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
    .where(eq(results.shooterId, shooterId))
    .orderBy(competitions.date);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-start gap-6">
        <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center text-2xl font-bold text-zinc-400">
          {shooter.firstName[0]}{shooter.lastName[0]}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">
            {shooter.lastName} {shooter.firstName}
            {shooter.verified && (
              <span className="ml-3 text-base font-normal text-emerald-600">Verifikovan</span>
            )}
          </h1>
          <div className="mt-1 flex gap-4 text-sm text-zinc-500">
            {shooter.club && <span>{shooter.club.name}</span>}
            {shooter.birthYear && <span>Rođ. {shooter.birthYear}</span>}
            {shooter.gender && (
              <span>{shooter.gender === "M" ? "Muški" : "Ženski"}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900">Istorija nastupa</h2>
        {shooterResults.length === 0 ? (
          <p className="mt-4 text-zinc-400">Nema unešenih rezultata.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Takmičenje</th>
                  <th className="px-4 py-3 text-left">Datum</th>
                  <th className="px-4 py-3 text-left">Disciplina</th>
                  <th className="px-4 py-3 text-right">Kval.</th>
                  <th className="px-4 py-3 text-right">Rank</th>
                  <th className="px-4 py-3 text-right">Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {shooterResults.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-900">{r.competitionName}</td>
                    <td className="px-4 py-3 text-zinc-600">{r.competitionDate}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-mono">
                        {r.disciplineCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-900">
                      {r.qualTotal ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600">
                      #{r.qualRank ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-600">
                      {r.finalTotal ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
