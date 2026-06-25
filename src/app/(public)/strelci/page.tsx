import { db } from "@/lib/db";
import { shooters, clubs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

export const metadata = { title: "Strelci" };

export default async function StrelciPage() {
  const data = await db
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      birthYear: shooters.birthYear,
      gender: shooters.gender,
      verified: shooters.verified,
      clubName: clubs.name,
      clubCity: clubs.city,
    })
    .from(shooters)
    .leftJoin(clubs, eq(shooters.clubId, clubs.id))
    .orderBy(shooters.lastName);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-end justify-between mb-8 pb-6 border-b border-[var(--border)]">
        <div>
          <h1
            className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
            style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.02em" }}
          >
            Strelci
          </h1>
          <p className="text-sm mt-1 text-[var(--muted)]">
            {data.length}{" "}
            {data.length === 1 ? "registrovan strelac" : "registrovanih strelaca"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {data.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-[var(--muted)]">Nema strelaca u bazi.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Strelac</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Klub</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">God.</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Pol</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--surface)] transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/strelci/${s.id}`}
                      className="font-semibold text-[var(--ink)] hover:underline"
                    >
                      {s.lastName} {s.firstName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {s.clubName ?? <span className="text-[var(--subtle)]">—</span>}
                    {s.clubCity && (
                      <span className="text-[var(--subtle)] ml-1 text-xs">{s.clubCity}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)]">
                    {s.birthYear ?? <span className="text-[var(--subtle)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {s.gender === "M"
                      ? "Muški"
                      : s.gender === "F"
                      ? "Ženski"
                      : <span className="text-[var(--subtle)]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {s.verified && (
                      <span
                        className="inline-flex items-center gap-1 text-[0.7rem] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: "var(--brand-primary-light)",
                          color: "var(--brand-primary)",
                        }}
                      >
                        ✓ Verifikovan
                      </span>
                    )}
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
