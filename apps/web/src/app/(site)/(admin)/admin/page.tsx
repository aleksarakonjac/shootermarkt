import { db } from "@shootermarkt/db";
import { competitions, competitionSchedule, mixedTeamResults, results, shooters } from "@shootermarkt/db/schema";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDateRangeSr } from "@/lib/date-utils";
import { LEVEL_LABEL, LEVEL_STYLE } from "@/lib/competition-utils";

export const metadata: Metadata = { title: "Admin — Pregled" };

const DAY = 86_400_000;
const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
const ISSF_LEVELS = ["international", "continental", "world", "olympic"] as const;

// Correlated subqueries: column refs are written table-qualified — drizzle renders bare ${col} unqualified in a
// single-table select, which would bind both sides to the subquery's own table.
const hasResults = sql<boolean>`(exists (select 1 from ${results} where ${results}.competition_id = "competitions"."id")
  or exists (select 1 from ${mixedTeamResults} where ${mixedTeamResults}.competition_id = "competitions"."id"))`;
const endDate = sql`coalesce(${competitions.dateEnd}, ${competitions.date})`;

export default async function AdminDashboardPage() {
  const today = isoDay(0);

  const [[{ unverified }], upcoming, unresolved, missingSius] = await Promise.all([
    db.select({ unverified: sql<number>`count(*)::int` }).from(shooters).where(eq(shooters.verified, false)),
    // Running now or starting within two weeks — what the live cron and ticker depend on.
    db
      .select({
        id: competitions.id,
        name: competitions.name,
        date: competitions.date,
        dateEnd: competitions.dateEnd,
        location: competitions.location,
        level: competitions.level,
        siusId: competitions.siusId,
        issfId: competitions.issfId,
        slots: sql<number>`(select count(*)::int from ${competitionSchedule} where ${competitionSchedule}.competition_id = "competitions"."id")`,
        resultCount: sql<number>`(select count(*)::int from ${results} where ${results}.competition_id = "competitions"."id")`,
      })
      .from(competitions)
      .where(and(lte(competitions.date, isoDay(14)), gte(endDate, today)))
      .orderBy(asc(competitions.date))
      .limit(10),
    // Finished in the last 60 days with nothing imported yet.
    db
      .select({ id: competitions.id, name: competitions.name, date: competitions.date, dateEnd: competitions.dateEnd, level: competitions.level })
      .from(competitions)
      .where(and(gte(endDate, isoDay(-60)), lte(endDate, isoDay(-1)), sql`not ${hasResults}`))
      .orderBy(desc(competitions.date)),
    // International events in the next 30 days that can't get live results (no SIUS UUID, no ISSF id).
    db
      .select({ id: competitions.id })
      .from(competitions)
      .where(and(
        gte(endDate, today),
        lte(competitions.date, isoDay(30)),
        inArray(competitions.level, [...ISSF_LEVELS]),
        isNull(competitions.siusId),
        isNull(competitions.issfId),
      )),
  ]);

  const todo = [
    { count: unresolved.length, label: "Završena takmičenja bez rezultata", hint: "Poslednjih 60 dana", href: "/admin/rezultati/period", action: "Uvezi rezultate" },
    { count: missingSius.length, label: "Međunarodna takmičenja bez izvora za live rezultate", hint: "Narednih 30 dana, bez SIUS UUID-a i ISSF ID-a", href: "/admin/takmicenja/sync", action: "Poveži" },
    { count: unverified, label: "Strelci čekaju verifikaciju", hint: "Profili koje su strelci sami napravili", href: "/admin/strelci?verified=0", action: "Pregledaj" },
  ].filter((item) => item.count > 0);

  return (
    <div className="max-w-5xl space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Pregled</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {new Intl.DateTimeFormat("sr-Latn-RS", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/takmicenja/sync" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border-strong)] px-4 text-sm font-semibold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--surface-2)]">
            Uvoz iz kalendara
          </Link>
          <Link href="/admin/rezultati" className="inline-flex min-h-11 items-center rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--brand-primary-hover)]">
            Uvoz rezultata
          </Link>
        </div>
      </header>

      <section aria-labelledby="todo-heading">
        <h2 id="todo-heading" className="mb-3 text-base font-semibold text-[var(--ink)]">Na redu</h2>
        {todo.length === 0 ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-sm text-[var(--muted)]">
            Sve je ažurno: nema takmičenja bez rezultata, sva predstojeća međunarodna imaju izvor, i nema profila na verifikaciji.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {todo.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="group flex min-h-16 items-center gap-4 px-5 py-3 transition-colors duration-150 hover:bg-[var(--surface-2)]">
                  <span className="w-10 shrink-0 text-right font-[family-name:var(--font-jetbrains-mono)] text-2xl font-bold tabular-nums text-[var(--ink)]">
                    {item.count}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[var(--ink)]">{item.label}</span>
                    <span className="block text-xs text-[var(--muted)]">{item.hint}</span>
                  </span>
                  <span className="hidden shrink-0 text-sm font-medium text-[var(--brand-primary)] sm:inline">{item.action}</span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="upcoming-heading">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="upcoming-heading" className="text-base font-semibold text-[var(--ink)]">U toku i narednih 14 dana</h2>
          <Link href="/admin/takmicenja" className="text-sm font-medium text-[var(--brand-primary)] hover:underline underline-offset-4">Kalendar</Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-sm text-[var(--muted)]">
            Nema takmičenja u ovom periodu. Nova dodaješ kroz <Link href="/admin/takmicenja/sync" className="font-medium text-[var(--brand-primary)] hover:underline underline-offset-4">uvoz iz kalendara</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {upcoming.map((c) => {
              const live = c.date <= today;
              return (
                <li key={c.id}>
                  <Link href={`/admin/takmicenja/${c.id}/edit`} className="flex flex-col gap-2 px-5 py-3 transition-colors duration-150 hover:bg-[var(--surface-2)] sm:flex-row sm:items-center sm:gap-4">
                    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap sm:w-48 font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)]">
                      {live && <span className="size-2 shrink-0 rounded-full bg-[var(--danger)]" aria-label="U toku" />}
                      {formatDateRangeSr(c.date, c.dateEnd)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-medium text-[var(--ink)] sm:line-clamp-1">{c.name}</span>
                      {c.location && <span className="block truncate text-xs text-[var(--muted)]">{c.location}</span>}
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <span className="rounded px-1.5 py-0.5 text-[0.7rem] font-semibold" style={LEVEL_STYLE[c.level]}>{LEVEL_LABEL[c.level] ?? c.level}</span>
                      <Status ok={c.slots > 0} label="Satnica" />
                      <Status ok={!!(c.siusId || c.issfId)} label={c.siusId ? "SIUS" : c.issfId ? "ISSF" : "Izvor"} />
                      {c.resultCount > 0 && <span className="text-xs tabular-nums text-[var(--muted)]">{c.resultCount} rez.</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {unresolved.length > 0 && (
        <section aria-labelledby="unresolved-heading">
          <h2 id="unresolved-heading" className="mb-3 text-base font-semibold text-[var(--ink)]">Završena bez rezultata</h2>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {unresolved.slice(0, 8).map((c) => (
              <li key={c.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="shrink-0 whitespace-nowrap font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--muted)] sm:w-48">{formatDateRangeSr(c.date, c.dateEnd)}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">{c.name}</span>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[0.7rem] font-semibold" style={LEVEL_STYLE[c.level]}>{LEVEL_LABEL[c.level] ?? c.level}</span>
              </li>
            ))}
          </ul>
          {unresolved.length > 8 && <p className="mt-2 text-xs text-[var(--muted)]">i još {unresolved.length - 8}.</p>}
        </section>
      )}
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.7rem] font-medium ${ok ? "bg-[var(--surface-2)] text-[var(--ink)]" : "text-[var(--danger)] ring-1 ring-inset ring-current"}`}
      title={ok ? `${label}: postoji` : `${label}: nedostaje`}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        {ok
          ? <path d="M2 5.2L4 7.2L8 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
      </svg>
      {label}
      <span className="sr-only">{ok ? " postoji" : " nedostaje"}</span>
    </span>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="shrink-0 text-[var(--muted)] transition-transform duration-150 group-hover:translate-x-0.5">
      <path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
