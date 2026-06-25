import { db } from "@/lib/db";
import { shooters, competitions, results } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboardPage() {
  const [[{ total: totalShooters }], [{ total: totalComps }], [{ total: totalResults }], unverified] =
    await Promise.all([
      db.select({ total: count() }).from(shooters),
      db.select({ total: count() }).from(competitions),
      db.select({ total: count() }).from(results),
      db
        .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName })
        .from(shooters)
        .where(eq(shooters.verified, false))
        .limit(10),
    ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Admin panel</h1>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: "Strelaca", value: totalShooters },
          { label: "Takmičenja", value: totalComps },
          { label: "Rezultata", value: totalResults },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-zinc-200 p-5">
            <p className="text-3xl font-bold text-zinc-900">{stat.value}</p>
            <p className="mt-1 text-sm text-zinc-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {unverified.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-zinc-900">
            Čekaju verifikaciju ({unverified.length})
          </h2>
          <div className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {unverified.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-zinc-900">
                  {s.lastName} {s.firstName}
                </span>
                <a
                  href={`/admin/strelci?id=${s.id}`}
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                >
                  Pregled →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
