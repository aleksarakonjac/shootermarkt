import Link from "next/link";
import { db } from "@/lib/db";
import { shooters, clubs, results, disciplines } from "@/lib/db/schema";
import { eq, desc, isNotNull, count, and } from "drizzle-orm";

export default async function HomePage() {
  const [shooterCount, topArm] = await Promise.all([
    db.select({ total: count() }).from(shooters),
    db
      .select({
        id: shooters.id,
        firstName: shooters.firstName,
        lastName: shooters.lastName,
        clubName: clubs.name,
        best: results.qualTotal,
      })
      .from(results)
      .innerJoin(shooters, eq(results.shooterId, shooters.id))
      .leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .where(and(eq(disciplines.code, "ARM"), isNotNull(results.qualTotal)))
      .orderBy(desc(results.qualTotal))
      .limit(5),
  ]);

  const total = shooterCount[0]?.total ?? 0;

  return (
    <>
      {/* Hero */}
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] mb-4 text-[var(--brand-primary)]">
              Srpsko streljaštvo
            </p>
            <h1
              className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase leading-[0.92] mb-6 text-[var(--ink)]"
              style={{ fontSize: "clamp(2.8rem, 7vw, 5.5rem)", letterSpacing: "-0.02em" }}
            >
              Tvoji rezultati.
              <br />
              <span className="text-[var(--brand-primary)]">Tvoja forma.</span>
              <br />
              Tvoj rang.
            </h1>
            <p className="text-base sm:text-lg leading-relaxed mb-8 text-[var(--muted)]" style={{ maxWidth: "52ch" }}>
              Prva digitalna platforma za srpske strelce — profili, rangiranje
              po disciplini i forma score algoritam na jednom mestu.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/rangiranje"
                className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors duration-150"
              >
                Vidi rangiranje
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                href="/strelci"
                className="inline-flex items-center gap-2 rounded-md border border-[var(--border-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors duration-150"
              >
                Pretraži strelce
              </Link>
            </div>
            {total > 0 && (
              <p className="mt-6 text-xs text-[var(--subtle)]">
                {total} {total === 1 ? "strelac" : "strelaca"} u bazi
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Discipline strip */}
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-stretch divide-x divide-[var(--border)]">
            {[
              { code: "ARM", name: "Air Rifle Men", max: "632" },
              { code: "ARW", name: "Air Rifle Women", max: "632" },
              { code: "APM", name: "Air Pistol Men", max: "600" },
              { code: "APW", name: "Air Pistol Women", max: "600" },
            ].map((d) => (
              <Link
                key={d.code}
                href={`/rangiranje?disciplina=${d.code.toLowerCase()}`}
                className="flex-1 flex flex-col items-center py-4 gap-0.5 hover:bg-[var(--surface-2)] transition-colors duration-150 no-underline"
              >
                <span className="font-[family-name:var(--font-barlow-condensed)] font-bold text-xl tracking-tight text-[var(--ink)]">
                  {d.code}
                </span>
                <span className="text-[0.7rem] hidden sm:block text-[var(--muted)]">{d.name}</span>
                <span className="text-[0.7rem] font-[family-name:var(--font-jetbrains-mono)] text-[var(--subtle)]">
                  max {d.max}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Top ARM preview */}
      <section className="py-12 sm:py-16 border-b border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <h2 className="font-[family-name:var(--font-barlow-condensed)] font-bold text-2xl uppercase tracking-tight text-[var(--ink)]">
                Top ARM
              </h2>
              <p className="text-sm mt-0.5 text-[var(--muted)]">
                10m Air Rifle Men — po najboljom kvalifikaciji
              </p>
            </div>
            <Link href="/rangiranje?disciplina=arm" className="text-xs font-semibold text-[var(--brand-primary)] hover:underline">
              Cela lista →
            </Link>
          </div>

          {topArm.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
              <p className="text-sm text-[var(--muted)]">Još uvek nema unešenih rezultata.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              {topArm.map((r, i) => (
                <div
                  key={r.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--surface)] transition-colors border-b border-[var(--border)] last:border-0"
                >
                  <span
                    className="w-7 text-right font-[family-name:var(--font-barlow-condensed)] font-bold text-lg shrink-0"
                    style={{ color: i === 0 ? "var(--brand-primary)" : "var(--subtle)" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Link href={`/strelci/${r.id}`} className="font-semibold text-sm text-[var(--ink)] hover:underline">
                      {r.lastName} {r.firstName}
                    </Link>
                    {r.clubName && (
                      <p className="text-xs text-[var(--muted)] truncate">{r.clubName}</p>
                    )}
                  </div>
                  <span className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-base tabular-nums text-[var(--ink)] shrink-0">
                    {r.best}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Feature triptych */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--border)] rounded-xl overflow-hidden border border-[var(--border)]">
            {[
              {
                stat: "↑ ↓ →",
                label: "Forma score",
                desc: "Weighted average poslednjih nastupa — zadnja 3 nose 50%, stariji manje. Sa trend koeficijentom i konzistentnost bonusom.",
              },
              {
                stat: "#1",
                label: "Rangiranje",
                desc: "Živo rangiranje po disciplini — ARM, ARW, APM, APW. Filtriraj po klubu ili takmičenju.",
              },
              {
                stat: "vs",
                label: "Head-to-head",
                desc: "Poređenje dva strelca kroz celu karijeru — serija po serija, takmičenje po takmičenje.",
              },
            ].map((f) => (
              <div key={f.label} className="bg-[var(--bg)] p-6 sm:p-8 flex flex-col gap-3">
                <div
                  className="font-[family-name:var(--font-barlow-condensed)] font-extrabold leading-none tabular-nums text-[var(--brand-primary)]"
                  style={{ fontSize: "3rem" }}
                >
                  {f.stat}
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-1 text-[var(--ink)]">{f.label}</h3>
                  <p className="text-sm leading-relaxed text-[var(--muted)]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
