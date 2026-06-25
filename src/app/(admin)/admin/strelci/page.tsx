import { db } from "@/lib/db";
import { shooters, clubs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { VerifyButton } from "./verify-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin · Strelci" };

export default async function AdminStrelciPage() {
  const data = await db
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      licenseNumber: shooters.licenseNumber,
      verified: shooters.verified,
      createdBySelf: shooters.createdBySelf,
      clubName: clubs.name,
    })
    .from(shooters)
    .leftJoin(clubs, eq(shooters.clubId, clubs.id))
    .orderBy(shooters.verified, shooters.lastName);

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Strelci</h1>
      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Ime</th>
              <th className="px-4 py-3 text-left">Klub</th>
              <th className="px-4 py-3 text-left">Licenca</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Akcija</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.map((s) => (
              <tr key={s.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">
                  {s.lastName} {s.firstName}
                  {s.createdBySelf && (
                    <span className="ml-2 text-xs text-blue-600">self</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-600">{s.clubName ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-zinc-600">
                  {s.licenseNumber ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {s.verified ? (
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Verifikovan
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      Na čekanju
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!s.verified && <VerifyButton shooterId={s.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
