import { db } from "@/lib/db";
import { competitions, results, disciplines, countries } from "@/lib/db/schema";
import { eq, desc, ilike, and, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompetitionsFilterBar } from "./CompetitionsFilterBar";
import type { CompetitionLevel, EventType } from "@/lib/pdf-import/types";

export const metadata: Metadata = { title: "Takmičenja" };

// ── Constants ─────────────────────────────────────────────────────────────────

const DISC_ORDER = ["ARM","ARW","APM","APW","RFM","RFW","R3JM","R3JW","SPW","RFPM","FPM"];

const LEVEL_META: Record<CompetitionLevel, { label: string; bg: string; color: string }> = {
  club:        { label: "Klubsko",       bg: "var(--surface-2)",      color: "var(--muted)"  },
  regional:    { label: "Regionalno",    bg: "oklch(0.52 0.15 25)",   color: "white"         },
  national:    { label: "Državno",       bg: "var(--success)",        color: "white"         },
  continental: { label: "Kont.",         bg: "oklch(0.50 0.18 290)",  color: "white"         },
  world:       { label: "Svetsko",       bg: "var(--brand-primary)",  color: "white"         },
  olympic:     { label: "Olimpijsko",    bg: "oklch(0.65 0.18 75)",   color: "white"         },
};

const TAG_META: Record<string, { bg: string; color: string }> = {
  sss:  { bg: "oklch(0.52 0.15 145)", color: "white" },
  issf: { bg: "var(--brand-primary)", color: "white" },
  esc:  { bg: "var(--brand-accent)",  color: "white" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: string, dateEnd?: string | null): string {
  const MONTHS = ["jan","feb","mar","apr","maj","jun","jul","avg","sep","okt","nov","dec"];
  const d = new Date(date + "T00:00:00");
  const s = `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  if (!dateEnd || dateEnd === date) return s;
  const de = new Date(dateEnd + "T00:00:00");
  if (de.getMonth() === d.getMonth()) return `${d.getDate()}–${de.getDate()}. ${MONTHS[d.getMonth()]}`;
  return `${s} – ${de.getDate()}. ${MONTHS[de.getMonth()]}`;
}

function sortDiscs(codes: string[]): string[] {
  return [...codes].sort(
    (a, b) => (DISC_ORDER.indexOf(a) >= 0 ? DISC_ORDER.indexOf(a) : 99) -
              (DISC_ORDER.indexOf(b) >= 0 ? DISC_ORDER.indexOf(b) : 99)
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ year?: string; level?: string; q?: string; tag?: string }>;
}

export default async function TakmicenjaPage({ searchParams }: Props) {
  const { year, level, q, tag } = await searchParams;

  const activeYear  = year  && /^\d{4}$/.test(year)  ? year  : "all";
  const activeLevel = level && level !== "all"        ? level : "all";
  const activeQ     = q?.trim() ?? "";
  const activeTag   = tag?.trim() ?? "";

  // ── Filters ────────────────────────────────────────────────────────────────
  const filters = [
    activeQ     ? ilike(competitions.name, `%${activeQ}%`)                              : undefined,
    activeYear  !== "all" ? ilike(competitions.date, `${activeYear}%`)                  : undefined,
    activeLevel !== "all" ? eq(competitions.level, activeLevel as CompetitionLevel)     : undefined,
    activeTag   ? sql`${competitions.tags} @> ARRAY[${activeTag}]::varchar[]`           : undefined,
  ].filter(Boolean) as Parameters<typeof and>;

  // ── Main query ─────────────────────────────────────────────────────────────
  const rows = await db
    .select({
      id:              competitions.id,
      name:            competitions.name,
      date:            competitions.date,
      dateEnd:         competitions.dateEnd,
      location:        competitions.location,
      level:           competitions.level,
      eventType:       competitions.eventType,
      tags:            competitions.tags,
      countryName:     countries.name,
      countryCode2:    countries.code2,
      disciplineCodes: sql<string[]>`
        coalesce(
          array_agg(DISTINCT ${disciplines.code}::text) FILTER (WHERE ${disciplines.code} IS NOT NULL),
          '{}'::text[]
        )
      `,
      resultCount: sql<number>`COUNT(DISTINCT ${results.id})::int`,
    })
    .from(competitions)
    .leftJoin(countries, eq(competitions.countryId, countries.id))
    .leftJoin(results, eq(results.competitionId, competitions.id))
    .leftJoin(disciplines, eq(results.disciplineId, disciplines.id))
    .where(filters.length ? and(...filters) : undefined)
    .groupBy(competitions.id, countries.name, countries.code2)
    .orderBy(desc(competitions.date));

  // ── Available years (for filter pills) ────────────────────────────────────
  const yearRows = await db
    .selectDistinct({ year: sql<string>`LEFT(${competitions.date}, 4)` })
    .from(competitions)
    .orderBy(desc(sql`LEFT(${competitions.date}, 4)`));
  const availableYears = yearRows.map((r) => r.year).filter(Boolean) as string[];

  const isFiltered = activeQ || activeYear !== "all" || activeLevel !== "all" || activeTag;

  // ── Group by year ──────────────────────────────────────────────────────────
  const byYear = new Map<string, typeof rows>();
  for (const row of rows) {
    const y = row.date.slice(0, 4);
    const arr = byYear.get(y) ?? [];
    arr.push(row);
    byYear.set(y, arr);
  }
  const sortedYears = [...byYear.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="mb-7">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.025em", lineHeight: 1.05 }}
        >
          Takmičenja
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1.5 max-w-[55ch]">
          Arhiva takmičenja sa rezultatima po disciplinama, nivoima i godinama.
        </p>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────── */}
      <Suspense fallback={<div className="h-10 mb-6" />}>
        <CompetitionsFilterBar
          availableYears={availableYears}
          currentYear={activeYear}
          currentLevel={activeLevel}
          currentQ={activeQ}
          currentTag={activeTag}
          totalCount={rows.length}
        />
      </Suspense>

      {/* ── Empty state ───────────────────────────────────────────── */}
      {rows.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] py-20 text-center">
          <p className="text-sm font-medium text-[var(--muted)]">
            {isFiltered
              ? "Nema takmičenja za izabrane filtere."
              : "Još nema unetih takmičenja."}
          </p>
          {isFiltered && (
            <Link
              href="/takmicenja"
              className="inline-block mt-3 text-xs text-[var(--brand-primary)] hover:underline"
            >
              Prikaži sva takmičenja
            </Link>
          )}
        </div>
      )}

      {/* ── Grouped list ─────────────────────────────────────────── */}
      <div className="space-y-2">
        {sortedYears.map((yr) => {
          const comps = byYear.get(yr)!;
          return (
            <section key={yr} aria-label={`Takmičenja ${yr}`}>
              {/* Year header */}
              <div
                className="flex items-center gap-4 py-4 sticky bg-[var(--bg)]"
                style={{ top: "64px", zIndex: "var(--z-sticky)" }}
              >
                <span
                  className="font-[family-name:var(--font-barlow-condensed)] font-extrabold leading-none select-none text-[var(--border-strong)]"
                  style={{ fontSize: "clamp(2rem, 5vw, 2.75rem)", letterSpacing: "-0.03em" }}
                >
                  {yr}
                </span>
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-xs text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] shrink-0">
                  {comps.length}
                </span>
              </div>

              {/* Competition rows */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden mb-6">
                {comps.map((comp, idx) => {
                  const levelMeta = LEVEL_META[comp.level as CompetitionLevel];
                  const discCodes = sortDiscs(comp.disciplineCodes ?? []);
                  const isLast = idx === comps.length - 1;
                  const tags = comp.tags ?? [];

                  return (
                    <Link
                      key={comp.id}
                      href={`/takmicenja/${comp.id}`}
                      className={`group flex items-center gap-3 sm:gap-4 px-4 py-3.5 transition-colors hover:bg-[var(--surface)] ${
                        !isLast ? "border-b border-[var(--border)]" : ""
                      }`}
                    >
                      {/* Date */}
                      <div className="shrink-0 w-[88px] hidden sm:block">
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--muted)] tabular-nums">
                          {formatDate(comp.date, comp.dateEnd)}
                        </span>
                      </div>

                      {/* Name + sublabel */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--ink)] group-hover:text-[var(--brand-primary)] transition-colors truncate leading-snug text-sm">
                          {comp.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          {/* Date on mobile */}
                          <span className="sm:hidden font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] text-[var(--subtle)] tabular-nums">
                            {formatDate(comp.date, comp.dateEnd)}
                          </span>
                          {(comp.location || comp.countryName) && (
                            <span className="text-xs text-[var(--subtle)] truncate hidden md:block">
                              {comp.countryCode2 && (
                                <>
                                  <span
                                    className={`fi fi-${comp.countryCode2.toLowerCase()} inline-block align-middle mr-1`}
                                    style={{ width: "14px", height: "10px", borderRadius: "1px" }}
                                  />
                                </>
                              )}
                              {comp.location}
                              {comp.countryName && comp.location && ` · ${comp.countryName}`}
                              {comp.countryName && !comp.location && comp.countryName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Discipline badges */}
                      <div className="hidden lg:flex items-center gap-1 shrink-0 flex-wrap justify-end max-w-[140px]">
                        {discCodes.slice(0, 5).map((code) => (
                          <span
                            key={code}
                            className="font-[family-name:var(--font-barlow-condensed)] font-bold text-[0.58rem] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--muted)]"
                          >
                            {code}
                          </span>
                        ))}
                        {discCodes.length > 5 && (
                          <span className="text-[0.58rem] text-[var(--subtle)]">
                            +{discCodes.length - 5}
                          </span>
                        )}
                      </div>

                      {/* Tags */}
                      {tags.length > 0 && (
                        <div className="hidden sm:flex items-center gap-1 shrink-0">
                          {tags.map((t) => {
                            const tm = TAG_META[t] ?? { bg: "var(--surface-2)", color: "var(--muted)" };
                            return (
                              <span
                                key={t}
                                className="font-[family-name:var(--font-jetbrains-mono)] font-semibold text-[0.6rem] uppercase px-1.5 py-0.5 rounded"
                                style={{ background: tm.bg, color: tm.color }}
                              >
                                {t}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Level badge */}
                      <div className="shrink-0">
                        {levelMeta && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-bold font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wide whitespace-nowrap"
                            style={{ background: levelMeta.bg, color: levelMeta.color }}
                          >
                            {levelMeta.label}
                          </span>
                        )}
                      </div>

                      {/* Result count */}
                      {comp.resultCount > 0 && (
                        <div className="shrink-0 hidden xl:block text-right" style={{ minWidth: "50px" }}>
                          <span className="text-[0.65rem] text-[var(--subtle)] font-[family-name:var(--font-jetbrains-mono)] tabular-nums">
                            {comp.resultCount}
                            <span className="ml-0.5 text-[0.6rem]">res.</span>
                          </span>
                        </div>
                      )}

                      {/* Chevron */}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        className="shrink-0 text-[var(--border-strong)] group-hover:text-[var(--muted)] transition-colors hidden sm:block"
                        aria-hidden="true"
                      >
                        <path
                          d="M4.5 2L8.5 6L4.5 10"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
