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
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-zinc-900">Strelci</h1>
      <p className="mt-2 text-zinc-500">{data.length} registrovanih strelaca</p>

      <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Ime i prezime</th>
              <th className="px-4 py-3 text-left">Klub</th>
              <th className="px-4 py-3 text-left">God.</th>
              <th className="px-4 py-3 text-left">Pol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                  Nema strelaca u bazi.
                </td>
              </tr>
            )}
            {data.map((s) => (
              <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/strelci/${s.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {s.lastName} {s.firstName}
                    {s.verified && (
                      <span className="ml-2 text-xs text-emerald-600">✓</span>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {s.clubName ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {s.birthYear ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {s.gender === "M" ? "Muški" : s.gender === "F" ? "Ženski" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
