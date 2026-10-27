import { db } from "@shootermarkt/db";
import { competitions, countries } from "@shootermarkt/db/schema";
import { desc, asc, ilike, and, sql, eq } from "drizzle-orm";
import { Fragment } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { TakmicenjaFilters } from "./takmicenja-filters";
import { TodayAnchor } from "./today-anchor";
import { LEVEL_STYLE, LEVEL_LABEL } from "@/lib/competition-utils";
import { formatDateRangeSr } from "@/lib/date-utils";
import { defaultFocusPriority } from "@/lib/competition-priority";
import { effectiveFocusPrioritySql } from "@/lib/competition-priority-sql";

export const metadata: Metadata = { title: "Admin · Takmičenja" };

const monthName = (m: number) =>
  new Intl.DateTimeFormat("sr-Latn", { month: "long" }).format(new Date(2000, m, 1));

export default async function AdminTakmicenjaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const currentYear = new Date().getFullYear().toString();
  const year = sp.year?.trim() ?? currentYear;
  const level = sp.level?.trim() ?? "";
  const tag = sp.tag?.trim() ?? "";
  const priority = sp.priority?.trim() ?? "";

  // Filter prioriteta: "manual" / "auto" = da li je ručno postavljen; broj = efektivni prioritet (ručni ili auto); "11+" = sve ispod klupskog nivoa.
  const priorityCondition = priority === "manual"
    ? sql`${competitions.focusPriority} is not null`
    : priority === "auto"
      ? sql`${competitions.focusPriority} is null`
      : priority === "11+"
        ? sql`${effectiveFocusPrioritySql()} >= 11`
        : /^\d+$/.test(priority)
          ? sql`${effectiveFocusPrioritySql()} = ${parseInt(priority)}`
          : undefined;

  const today = new Date().toISOString().split("T")[0];

  const conditions = [
    q ? ilike(competitions.name, `%${q}%`) : undefined,
    year ? sql`date_part('year', ${competitions.date}::date) = ${parseInt(year)}` : undefined,
    level ? eq(competitions.level, level as "club" | "regional" | "national" | "continental" | "world" | "olympic") : undefined,
    tag ? sql`${competitions.tags} @> ARRAY[${tag}]::varchar[]` : undefined,
    priorityCondition,
  ].filter(Boolean) as Parameters<typeof and>;

  const baseWhere = conditions.length ? and(...conditions) : undefined;

  const listCols = {
        id: competitions.id,
        name: competitions.name,
        nameSr: competitions.nameSr,
        nameEn: competitions.nameEn,
        date: competitions.date,
        dateEnd: competitions.dateEnd,
        location: competitions.location,
        locationSr: competitions.locationSr,
        countryCode: countries.code,
        countryCode2: countries.code2,
        level: competitions.level,
        issfId: competitions.issfId,
        organizer: competitions.organizer,
        eventType: competitions.eventType,
        ageCategory: competitions.ageCategory,
        focusPriority: competitions.focusPriority,
      };

  const currentCondition = and(
    sql`${competitions.date} <= ${today}`,
    sql`coalesce(${competitions.dateEnd}, ${competitions.date}) >= ${today}`,
  );

  const [data, yearRows, currentCompetitions] = await Promise.all([
    db
      .select(listCols)
      .from(competitions)
      .leftJoin(countries, eq(competitions.countryId, countries.id))
      .where(baseWhere)
      .orderBy(asc(competitions.date), asc(competitions.dateEnd), desc(competitions.id)),
    db
      .select({ year: sql<number>`date_part('year', ${competitions.date}::date)::int` })
      .from(competitions)
      .groupBy(sql`date_part('year', ${competitions.date}::date)`)
      .orderBy(desc(sql`date_part('year', ${competitions.date}::date)`)),
    db
      .select(listCols)
      .from(competitions)
      .leftJoin(countries, eq(competitions.countryId, countries.id))
      .where(currentCondition)
      .orderBy(asc(competitions.date), asc(competitions.dateEnd), desc(competitions.id)),
  ]);

  // Ručni prioritet je običan broj; auto je približan (bez kategorija iz rasporeda) pa je prigušen i sa "auto".
  const renderPriority = (c: (typeof data)[number]) => c.focusPriority != null
    ? <span className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-bold text-[var(--ink)] tabular-nums">{c.focusPriority}</span>
    : <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--subtle)] tabular-nums" title="Automatski prioritet (bez kategorija iz rasporeda)">auto {defaultFocusPriority(c)}</span>;

  const isCurrentYear = year === currentYear;
  // Sidro: prvo takmičenje koje je u toku ili tek dolazi.
  const anchorId = isCurrentYear
    ? data.find((c) => (c.dateEnd ?? c.date) >= today)?.id
    : undefined;
  const byMonth = new Map<number, typeof data>();
  for (const c of data) {
    const m = parseInt(c.date.slice(5, 7)) - 1;
    byMonth.set(m, [...(byMonth.get(m) ?? []), c]);
  }
  const months = [...byMonth.entries()].sort((a, b) => a[0] - b[0]);

  const renderName = (c: (typeof data)[number]) => (
    <span className="flex min-w-0 flex-col md:max-w-sm">
                              <span className="md:truncate">{c.nameSr ?? c.name}</span>
                              <span className="text-xs font-normal text-[var(--muted)] md:truncate">{c.nameEn ?? c.name}</span>
                              {(c.countryCode || c.locationSr || c.location) && (
                                <span className="mt-0.5 flex items-center gap-1.5 text-xs font-normal text-[var(--muted)]">
                                  {c.countryCode2 && (
                                    <span
                                      className={`fi fi-${c.countryCode2.toLowerCase()} shrink-0`}
                                      style={{ width: "13px", height: "9px", borderRadius: "1px", display: "inline-block" }}
                                    />
                                  )}
                                  {c.countryCode && (
                                    <span className="rounded bg-[var(--surface)] border border-[var(--border)] px-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold text-[var(--ink)]">
                                      {c.countryCode}
                                    </span>
                                  )}
                                  <span className="truncate">{c.locationSr ?? c.location}</span>
                                </span>
                              )}
                            </span>
  );

  const years = yearRows.map((r) => r.year).filter(Boolean);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-6">
        <div>
          <h1
            className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
          >
            Takmičenja
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">{data.length} {year}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/takmicenja/prevodi?year=${year || currentYear}`}
            className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
          >
            Prevedi sve →
          </Link>
          <Link
            href="/admin/takmicenja/bulk"
            className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
          >
            Bulk izmena
          </Link>
          <Link
            href="/admin/takmicenja/sync"
            className="rounded-md border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface)] transition-colors"
          >
            Sync →
          </Link>
          <Link
            href="/admin/takmicenja/novi"
            className="rounded-md px-4 py-2 text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            + Dodaj
          </Link>
        </div>
      </div>

      {currentCompetitions.length > 0 && (
        <section aria-labelledby="current-competitions-heading" className="mb-8">
          <div className="flex items-baseline justify-between gap-4 mb-3">
            <h2
              id="current-competitions-heading"
              className="font-[family-name:var(--font-barlow-condensed)] text-lg font-extrabold uppercase tracking-tight text-[var(--ink)]"
            >
              U toku
            </h2>
            <span className="text-xs text-[var(--muted)]">
              {currentCompetitions.length} {currentCompetitions.length === 1 ? "takmičenje" : "takmičenja"}
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-[var(--live-border)] bg-[var(--live-bg)] divide-y divide-[var(--live-border)]">
            {currentCompetitions.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3.5">
                <div className="flex min-w-0 basis-full items-center gap-2.5 sm:basis-0 sm:flex-1">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--live-dot)]" aria-hidden="true" />
                  <span className="font-semibold text-[var(--ink)]">{renderName(c)}</span>
                </div>
                <span className="whitespace-nowrap font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)]">
                  {formatDateRangeSr(c.date, c.dateEnd)}
                </span>
                <span className="text-[0.7rem] font-semibold px-2 py-0.5 rounded" style={LEVEL_STYLE[c.level] ?? { background: "#f3f4f6", color: "#4b5563" }}>
                  {LEVEL_LABEL[c.level] ?? c.level}
                </span>
                <Link href={`/admin/takmicenja/${c.id}/edit`} className="ml-auto text-xs font-semibold text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors">
                  Uredi →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-start gap-2">
        <TakmicenjaFilters years={years} currentLevel={level} currentTag={tag} currentPriority={priority} />
        <TodayAnchor autoScroll={year === currentYear} />
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
            <tbody>
              {months.map(([m, items]) => (
                <Fragment key={m}>
                  <tr>
                    <th
                      colSpan={4}
                      className="bg-[var(--surface)] border-y border-[var(--border)] px-4 py-2 text-left font-[family-name:var(--font-barlow-condensed)] text-base font-extrabold uppercase tracking-tight text-[var(--ink)]"
                    >
                      {monthName(m)}
                      <span className="ml-2 text-xs font-normal text-[var(--muted)]">{items.length}</span>
                    </th>
                  </tr>
                  {items.map((c) => {
                    const live = c.date <= today && (c.dateEnd ?? c.date) >= today;
                    const isAnchor = c.id === anchorId;
                    return (
                      <tr
                        key={c.id}
                        id={isAnchor ? "danas" : undefined}
                        className={`scroll-mt-20 border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors ${live ? "bg-[var(--live-bg)]" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium text-[var(--ink)]">
                          <Link href={`/admin/takmicenja/${c.id}/edit`} className="flex items-center gap-2 no-underline">
                            {live && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--live-dot)]" aria-label="U toku" />}
                            {renderName(c)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] whitespace-nowrap">
                          {formatDateRangeSr(c.date, c.dateEnd)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[0.7rem] font-semibold px-2 py-0.5 rounded" style={LEVEL_STYLE[c.level] ?? { background: "#f3f4f6", color: "#4b5563" }}>
                            {LEVEL_LABEL[c.level] ?? c.level}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 whitespace-nowrap md:table-cell">{renderPriority(c)}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
