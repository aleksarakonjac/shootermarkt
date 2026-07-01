import { db } from "@/lib/db";
import { shooters, competitions, results } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Admin — Pregled" };

export default async function AdminDashboardPage() {
  const [[{ total: totalShooters }], [{ total: totalComps }], [{ total: totalResults }], unverified] =
    await Promise.all([
      db.select({ total: count() }).from(shooters),
      db.select({ total: count() }).from(competitions),
      db.select({ total: count() }).from(results),
      db
        .select({
          id: shooters.id,
          firstName: shooters.firstName,
          lastName: shooters.lastName,
        })
        .from(shooters)
        .where(eq(shooters.verified, false))
        .limit(10),
    ]);

  return (
    <div className="max-w-3xl">

      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[var(--ink)] tracking-tight">Pregled</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Stanje sistema i zadaci na čekanju.</p>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────── */}
      <div className="flex divide-x divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden mb-8">
        {[
          { label: "Strelaca",    value: totalShooters,  href: "/admin/strelci" },
          { label: "Takmičenja",  value: totalComps,     href: "/admin/takmicenja" },
          { label: "Rezultata",   value: totalResults,   href: null },
        ].map((stat) => (
          <div key={stat.label} className="flex-1 px-6 py-5 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors group">
            {stat.href ? (
              <Link href={stat.href} className="block no-underline">
                <p
                  className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)] tabular-nums"
                  style={{ fontSize: "1.75rem", lineHeight: 1, letterSpacing: "-0.04em" }}
                >
                  {stat.value}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1.5 group-hover:text-[var(--brand-primary)] transition-colors">
                  {stat.label} →
                </p>
              </Link>
            ) : (
              <>
                <p
                  className="font-[family-name:var(--font-jetbrains-mono)] font-bold text-[var(--ink)] tabular-nums"
                  style={{ fontSize: "1.75rem", lineHeight: 1, letterSpacing: "-0.04em" }}
                >
                  {stat.value}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1.5">{stat.label}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Pending verifications ──────────────────────────────────── */}
      {unverified.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--ink)]">
              Čekaju verifikaciju
            </h2>
            <span className="text-[0.65rem] font-bold font-[family-name:var(--font-jetbrains-mono)] px-2 py-0.5 rounded-full bg-[var(--brand-primary)] text-white tabular-nums">
              {unverified.length}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            {unverified.map((s, idx) => (
              <Link
                key={s.id}
                href={`/admin/strelci?id=${s.id}`}
                className={`group flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-2)] transition-colors ${
                  idx < unverified.length - 1 ? "border-b border-[var(--border)]" : ""
                }`}
              >
                <span className="text-sm text-[var(--ink)] font-medium">
                  {s.lastName} {s.firstName}
                </span>
                <span className="text-xs text-[var(--muted)] group-hover:text-[var(--brand-primary)] transition-colors">
                  Verifikuj →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Quick actions ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">Brzi pristup</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/admin/takmicenja/novi", label: "Novo takmičenje",   desc: "Unesi ručno" },
            { href: "/admin/strelci/novi",    label: "Novi strelac",      desc: "Dodaj profil" },
            { href: "/admin/import",          label: "PDF import",         desc: "Uči bilten" },
            { href: "/admin/takmicenja/sync", label: "Sync takmičenja",    desc: "ISSF / SSS / ESC" },
            { href: "/admin/sius",            label: "SIUS rezultati",     desc: "Importuj XML" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center justify-between px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)] transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-[var(--ink)] leading-snug">{action.label}</p>
                <p className="text-xs text-[var(--subtle)] mt-0.5">{action.desc}</p>
              </div>
              <svg
                width="12" height="12" viewBox="0 0 12 12"
                className="shrink-0 text-[var(--border-strong)] group-hover:text-[var(--muted)] transition-colors"
                aria-hidden="true"
              >
                <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
