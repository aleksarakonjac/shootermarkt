import { db } from "@shootermarkt/db";
import { shooters, competitions, results, disciplines } from "@shootermarkt/db/schema";
import { count, desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Admin — Kontrolni centar" };

const LEVEL_LABELS: Record<string, string> = {
  club: "Klubsko",
  regional: "Regionalno",
  national: "Državno",
  international: "Međunarodno",
  continental: "Kontinentalno",
  world: "Svetsko",
  olympic: "Olimpijsko",
};

const SOURCE_LABELS: Record<string, string> = {
  pdf_import: "PDF",
  manual: "Ručno",
  issf_import: "ISSF",
  esc_import: "ESC",
};

const dateFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const parsed = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  if (Number.isNaN(parsed.getTime())) return "—";
  return dateFormatter.format(parsed);
}

function formatDateRange(start: string | Date | null | undefined, end?: string | Date | null) {
  if (!start) return "—";
  const fmtStart = formatDate(start);
  if (!end || end === start) return fmtStart;
  return `${fmtStart} – ${formatDate(end)}`;
}

function formatTimestamp(value: string | Date | null | undefined) {
  if (!value) return "—";
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return "—";
  return `${dateFormatter.format(parsed)} · ${parsed.toLocaleTimeString("sr-Latn-RS", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default async function AdminDashboardPage() {
  const [[{ total: totalShooters }], [{ total: totalComps }], [{ total: totalResults }], [{ total: totalVerified }], [{ total: totalUnverified }], sourceRows, unverified, recentCompetitions, recentResults] =
    await Promise.all([
      db.select({ total: count() }).from(shooters),
      db.select({ total: count() }).from(competitions),
      db.select({ total: count() }).from(results),
      db.select({ total: count() }).from(shooters).where(eq(shooters.verified, true)),
      db.select({ total: count() }).from(shooters).where(eq(shooters.verified, false)),
      db
        .select({
          source: results.source,
          total: sql<number>`count(*)::int`,
        })
        .from(results)
        .groupBy(results.source),
      db
        .select({
          id: shooters.id,
          firstName: shooters.firstName,
          lastName: shooters.lastName,
        })
        .from(shooters)
        .where(eq(shooters.verified, false))
        .limit(8),
      db
        .select({
          id: competitions.id,
          name: competitions.name,
          date: competitions.date,
          dateEnd: competitions.dateEnd,
          location: competitions.location,
          level: competitions.level,
          organizer: competitions.organizer,
          sourcePdfUrl: competitions.sourcePdfUrl,
          createdAt: competitions.createdAt,
        })
        .from(competitions)
        .orderBy(desc(competitions.createdAt))
        .limit(5),
      db
        .select({
          id: results.id,
          createdAt: results.createdAt,
          source: results.source,
          qualTotal: results.qualTotal,
          finalTotal: results.finalTotal,
          shooterFirstName: shooters.firstName,
          shooterLastName: shooters.lastName,
          competitionName: competitions.name,
          competitionDate: competitions.date,
          disciplineCode: disciplines.code,
        })
        .from(results)
        .leftJoin(shooters, eq(results.shooterId, shooters.id))
        .leftJoin(competitions, eq(results.competitionId, competitions.id))
        .leftJoin(disciplines, eq(results.disciplineId, disciplines.id))
        .orderBy(desc(results.createdAt))
        .limit(5),
    ]);

  const verifiedShooters = totalVerified ?? totalShooters - totalUnverified;
  const sourceTotals = Object.fromEntries(sourceRows.map((row) => [row.source, row.total])) as Record<string, number>;

  const priorityItems = [
    {
      label: "Čeka verifikaciju",
      value: totalUnverified,
      note: totalUnverified > 0 ? "Mora ući u profil pregled" : "Sve novo je trenutno provereno",
    },
    {
      label: "Verifikovani profili",
      value: verifiedShooters,
      note: "Spremni za javni prikaz",
    },
    {
      label: "Rezultati iz PDF-a",
      value: sourceTotals.pdf_import ?? 0,
      note: "Bilteni i import pipeline",
    },
    {
      label: "Ručni unosi",
      value: sourceTotals.manual ?? 0,
      note: "Administrativno održavanje",
    },
  ];

  return (
    <div className="max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--subtle)]">
            Admin / kontrola sistema
          </p>
          <h1 className="mt-2 text-[clamp(2rem,3vw,2.75rem)] font-semibold tracking-tight text-[var(--ink)]">
            Kontrolni centar za verifikaciju, import i zdravlje baze.
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)] max-w-2xl">
            Ovo je mesto gde admin vidi šta čeka ručnu odluku, šta je tek stiglo iz PDF ili ISSF toka, i gde sistem može da zapne pre nego što to vidi korisnik.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/strelci?verified=0"
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Verifikacije
          </Link>
          <Link
            href="/admin/import"
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            PDF import
          </Link>
          <Link
            href="/admin/rezultati"
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-transparent px-5 py-3 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
          >
            Unos rezultata
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {priorityItems.map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4"
          >
            <p className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
              {item.label}
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-[2rem] font-bold leading-none tracking-[-0.04em] text-[var(--ink)] tabular-nums">
                {item.value}
              </p>
              <span className="text-[0.72rem] text-[var(--muted)] text-right max-w-[16ch]">
                {item.note}
              </span>
            </div>
          </article>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6 min-w-0">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--ink)]">Čekaju verifikaciju</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {unverified.length > 0
                    ? `${unverified.length} profila traži pregled pre javnog prikaza.`
                    : "Nema novih profila na čekanju."}
                </p>
              </div>
              <span className="rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[0.7rem] font-semibold text-white tabular-nums">
                {totalUnverified}
              </span>
            </div>

            {unverified.length > 0 ? (
              <ul className="divide-y divide-[var(--border)]">
                {unverified.map((shooter) => (
                  <li key={shooter.id}>
                    <Link
                      href={`/admin/strelci/${shooter.id}`}
                      className="flex min-h-14 items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <div>
                        <p className="font-medium text-[var(--ink)]">
                          {shooter.lastName} {shooter.firstName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Otvori profil i potvrdi identitet
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium text-[var(--brand-primary)]">
                        Verifikuj →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-10 text-sm text-[var(--muted)]">
                Red je prazan. Ako neko novi registruje profil, ovde će se pojaviti odmah.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--ink)]">Poslednje aktivnosti</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Najnoviji importi i rezultati koji su ušli u sistem.
                </p>
              </div>
              <Link href="/admin/takmicenja" className="text-sm font-medium text-[var(--brand-primary)] hover:underline">
                Sva takmičenja
              </Link>
            </div>

            <div className="grid gap-0 lg:grid-cols-2">
              <div className="border-b border-[var(--border)] lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--subtle)]">
                    Najnovija takmičenja
                  </h3>
                  <span className="text-xs text-[var(--muted)]">{recentCompetitions.length}</span>
                </div>
                {recentCompetitions.length > 0 ? (
                  <ul className="divide-y divide-[var(--border)]">
                    {recentCompetitions.map((competition) => (
                      <li key={competition.id}>
                        <Link
                          href="/admin/takmicenja"
                          className="block min-h-14 px-5 py-4 transition-colors hover:bg-[var(--surface-2)]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="font-medium text-[var(--ink)] line-clamp-2">
                                {competition.name}
                              </p>
                              <p className="mt-1 text-sm text-[var(--muted)]">
                                {formatDateRange(competition.date, competition.dateEnd)}
                                {competition.location ? ` · ${competition.location}` : ""}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[0.68rem] font-semibold text-[var(--muted)]">
                              {LEVEL_LABELS[competition.level] ?? competition.level}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--subtle)]">
                            <span>{competition.organizer ?? "Nepoznat organizator"}</span>
                            <span>{competition.sourcePdfUrl ? "PDF izvor" : "Bez PDF izvora"}</span>
                            <span>{formatTimestamp(competition.createdAt)}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-5 py-10 text-sm text-[var(--muted)]">
                    Još nema takmičenja u bazi.
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--subtle)]">
                    Najnoviji rezultati
                  </h3>
                  <span className="text-xs text-[var(--muted)]">{recentResults.length}</span>
                </div>
                {recentResults.length > 0 ? (
                  <ul className="divide-y divide-[var(--border)]">
                    {recentResults.map((result) => {
                      const score = result.finalTotal ?? result.qualTotal;
                      const phaseLabel = result.finalTotal ? "Final" : "Kval.";

                      return (
                        <li key={result.id}>
                          <Link
                            href="/admin/rezultati"
                            className="block min-h-14 px-5 py-4 transition-colors hover:bg-[var(--surface-2)]"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="font-medium text-[var(--ink)]">
                                  {result.shooterLastName} {result.shooterFirstName}
                                </p>
                                <p className="mt-1 text-sm text-[var(--muted)]">
                                  {result.competitionName ?? "Takmičenje bez naziva"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-[family-name:var(--font-jetbrains-mono)] text-lg font-bold leading-none tracking-[-0.04em] text-[var(--ink)] tabular-nums">
                                  {score ?? "—"}
                                </p>
                                <p className="mt-1 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">
                                  {phaseLabel} · {result.disciplineCode ?? "—"}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--subtle)]">
                              <span>{formatDate(result.competitionDate)}</span>
                              <span>{SOURCE_LABELS[result.source] ?? result.source}</span>
                              <span>{formatTimestamp(result.createdAt)}</span>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-5 py-10 text-sm text-[var(--muted)]">
                    Nema unetih rezultata.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6 min-w-0">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Operativni prečaci</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Najčešće admin radnje, bez traženja po meniju.
              </p>
            </div>
            <div className="p-3">
              <div className="grid gap-2">
                {[
                  { href: "/admin/strelci/novi", label: "Novi strelac", desc: "Ručni unos profila" },
                  { href: "/admin/takmicenja/novi", label: "Novo takmičenje", desc: "Unesi manifestaciju" },
                  { href: "/admin/import", label: "PDF import", desc: "Bilten → pregled" },
                  { href: "/admin/takmicenja/sync", label: "Sync takmičenja", desc: "ISSF / SSS / ESC" },
                ].map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex min-h-14 items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-white/30 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--ink)]">{action.label}</p>
                      <p className="mt-0.5 text-xs text-[var(--subtle)]">{action.desc}</p>
                    </div>
                    <span className="text-[var(--muted)] transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Zdravlje izvora</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Šta se trenutno najviše koristi za unos i sinhronizaciju.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-[var(--border)]">
              {[
                { label: "Strelci", value: totalShooters },
                { label: "Takmičenja", value: totalComps },
                { label: "Rezultati", value: totalResults },
                { label: "Verifikovani", value: verifiedShooters },
              ].map((item) => (
                <div key={item.label} className="bg-[var(--surface)] px-4 py-4">
                  <dt className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">
                    {item.label}
                  </dt>
                  <dd className="mt-2 font-[family-name:var(--font-jetbrains-mono)] text-2xl font-bold leading-none tracking-[-0.04em] text-[var(--ink)] tabular-nums">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="border-t border-[var(--border)] px-5 py-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--subtle)]">
                Izvori rezultata
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                  <span
                    key={key}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--ink)]"
                  >
                    {label} {sourceTotals[key] ?? 0}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-sm font-semibold text-[var(--ink)]">Brzi signal</h2>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm text-[var(--muted)]">
              <p>
                Ako je queue za verifikaciju prazan, sledeći posao je import novih biltena ili ručni unos rezultata.
              </p>
              <p>
                Kada se pojavi PDF, prvo proveri da li ima source link i da li rezultati ulaze kroz očekivani source tok.
              </p>
              <p>
                Fokus ovog panela je brzina odluke, ne dekoracija: da admin vidi šta mora da uradi u narednih nekoliko minuta.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
