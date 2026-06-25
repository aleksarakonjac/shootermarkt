import { db } from "@/lib/db";
import { shooters, clubs, results, disciplines } from "@/lib/db/schema";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import Link from "next/link";

export const metadata = { title: "Rangiranje" };

type DisciplineCode = "ARM" | "ARW" | "APM" | "APW";

type Props = { searchParams: Promise<{ disciplina?: string }> };

export default async function RangiranjeePage({ searchParams }: Props) {
  const { disciplina } = await searchParams;
  const activeCode = (disciplina?.toUpperCase() ?? "ARM") as DisciplineCode;

  const discipline = await db.query.disciplines.findFirst({
    where: eq(disciplines.code, activeCode as "ARM" | "ARW" | "APM" | "APW"),
  });

  const ranking = discipline
    ? await db
        .select({
          shooterId: results.shooterId,
          firstName: shooters.firstName,
          lastName: shooters.lastName,
          clubName: clubs.name,
          bestQual: results.qualTotal,
        })
        .from(results)
        .innerJoin(shooters, eq(results.shooterId, shooters.id))
        .leftJoin(clubs, eq(shooters.clubId, clubs.id))
        .where(
          and(
            eq(results.disciplineId, discipline.id),
            isNotNull(results.qualTotal)
          )
        )
        .orderBy(desc(results.qualTotal))
        .limit(50)
    : [];

  const tabs: DisciplineCode[] = ["ARM", "ARW", "APM", "APW"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-zinc-900">Rangiranje</h1>
      <p className="mt-1 text-zinc-500">Najbolji rezultat po disciplini</p>

      <div className="mt-6 flex gap-2">
        {tabs.map((code) => (
          <Link
            key={code}
            href={`/rangiranje?disciplina=${code.toLowerCase()}`}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeCode === code
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {code}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left w-12">#</th>
              <th className="px-4 py-3 text-left">Strelac</th>
              <th className="px-4 py-3 text-left">Klub</th>
              <th className="px-4 py-3 text-right">Rezultat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {ranking.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                  Nema podataka za ovu disciplinu.
                </td>
              </tr>
            )}
            {ranking.map((r, i) => (
              <tr key={`${r.shooterId}-${i}`} className="hover:bg-zinc-50">
                <td className="px-4 py-3 text-zinc-400 font-mono">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/strelci/${r.shooterId}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {r.lastName} {r.firstName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600">{r.clubName ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-900">
                  {r.bestQual}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
