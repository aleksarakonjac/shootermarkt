import { db } from "@/lib/db";
import { shooters, clubs, results, disciplines } from "@/lib/db/schema";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import Link from "next/link";

export const metadata = { title: "Rangiranje" };

type DisciplineCode = "ARM" | "ARW" | "APM" | "APW";

const TABS: { code: DisciplineCode; name: string }[] = [
  { code: "ARM", name: "Air Rifle Men" },
  { code: "ARW", name: "Air Rifle Women" },
  { code: "APM", name: "Air Pistol Men" },
  { code: "APW", name: "Air Pistol Women" },
];

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
          qualInners: results.qualInners,
        })
        .from(results)
        .innerJoin(shooters, eq(results.shooterId, shooters.id))
        .leftJoin(clubs, eq(shooters.clubId, clubs.id))
        .where(and(eq(results.disciplineId, discipline.id), isNotNull(results.qualTotal)))
        .orderBy(desc(results.qualTotal))
        .limit(50)
    : [];

  const activeTab = TABS.find((t) => t.code === activeCode);

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
          Najbolji rezultat po disciplini
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
              className="flex flex-col items-center px-4 py-2 rounded-md text-center transition-colors duration-150"
              style={{
                background: active ? "var(--bg)" : "transparent",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                textDecoration: "none",
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

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {ranking.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-[var(--muted)]">
              Nema podataka za {activeTab?.name ?? activeCode}.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th className="w-12 px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">#</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Strelac</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Klub</th>
                {activeCode.startsWith("AP") && (
                  <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Inners</th>
                )}
                <th className="px-4 py-3 text-right text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Rezultat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {ranking.map((r, i) => (
                <tr key={`${r.shooterId}-${i}`} className="hover:bg-[var(--surface)] transition-colors">
                  <td
                    className="w-12 px-4 py-3 text-right font-[family-name:var(--font-barlow-condensed)] font-bold text-lg"
                    style={{ color: i === 0 ? "var(--brand-primary)" : "var(--subtle)" }}
                  >
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/strelci/${r.shooterId}`}
                      className="font-semibold text-[var(--ink)] hover:underline"
                    >
                      {r.lastName} {r.firstName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {r.clubName ?? <span className="text-[var(--subtle)]">—</span>}
                  </td>
                  {activeCode.startsWith("AP") && (
                    <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] text-sm text-[var(--muted)]">
                      {r.qualInners != null ? `${r.qualInners}x` : <span className="text-[var(--subtle)]">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[var(--ink)]">
                    {r.bestQual}
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
