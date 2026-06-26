import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin · Takmičenja" };

const LEVEL_LABEL: Record<string, string> = {
  drzavno: "Državno",
  kup: "Kup",
  regionalno: "Regionalno",
  medjunarodno: "Međunarodno",
};

export default async function AdminTakmicenjaPage() {
  const data = await db.select().from(competitions).orderBy(desc(competitions.date));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
          >
            Takmičenja
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">{data.length} u bazi</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/takmicenja/issf"
            className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
          >
            Sync ISSF →
          </Link>
          <Link
            href="/admin/takmicenja/novi"
            className="rounded-md px-4 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            + Dodaj
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {data.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--muted)]">
            Nema takmičenja.{" "}
            <Link href="/admin/takmicenja/novi" className="text-[var(--brand-primary)] hover:underline">
              Dodaj prvo →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Naziv</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Datum</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Lokacija</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Nivo</th>
                <th className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">ISSF ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--surface)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">{c.name}</td>
                  <td className="px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                    {c.date}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {c.location ?? <span className="text-[var(--subtle)]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[0.7rem] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "var(--surface-2)", color: "var(--muted)" }}
                    >
                      {LEVEL_LABEL[c.level] ?? c.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] text-[var(--subtle)]">
                    {c.issfId ?? "—"}
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
