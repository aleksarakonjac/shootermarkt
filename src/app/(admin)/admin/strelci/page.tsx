import { db } from "@/lib/db";
import { shooters, clubs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { VerifyButton } from "./verify-button";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin · Strelci" };

export default async function AdminStrelciPage() {
  const data = await db
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      nationality: shooters.nationality,
      licenseNumber: shooters.licenseNumber,
      verified: shooters.verified,
      createdBySelf: shooters.createdBySelf,
      issfId: shooters.issfId,
      clubName: clubs.name,
    })
    .from(shooters)
    .leftJoin(clubs, eq(shooters.clubId, clubs.id))
    .orderBy(shooters.verified, shooters.lastName);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
          >
            Strelci
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">{data.length} u bazi</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/strelci/issf"
            className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
          >
            Bulk ISSF →
          </Link>
          <Link
            href="/admin/strelci/novi"
            className="rounded-md px-4 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            + Dodaj strelca
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {data.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--muted)]">
            Nema strelaca. <Link href="/admin/strelci/novi" className="text-[var(--brand-primary)] hover:underline">Dodaj prvog →</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Strelac</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Zemlja</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Klub</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Licenca</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">ISSF</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--surface)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">
                    {s.lastName} {s.firstName}
                    {s.createdBySelf && (
                      <span className="ml-2 text-[0.65rem] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--brand-primary-light)", color: "var(--brand-primary)" }}>
                        self
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold text-[var(--ink)]">
                    {s.nationality ?? <span className="text-[var(--subtle)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{s.clubName ?? <span className="text-[var(--subtle)]">—</span>}</td>
                  <td className="px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                    {s.licenseNumber ?? <span className="text-[var(--subtle)]">—</span>}
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] text-[var(--subtle)]">
                    {s.issfId ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.verified ? (
                      <span className="text-[0.7rem] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--brand-primary-light)", color: "var(--brand-primary)" }}>
                        ✓ Verifikovan
                      </span>
                    ) : (
                      <span className="text-[0.7rem] font-semibold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.97 0.05 75)", color: "var(--warning)" }}>
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
        )}
      </div>
    </div>
  );
}
