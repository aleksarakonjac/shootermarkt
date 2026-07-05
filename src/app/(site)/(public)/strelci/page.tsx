export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { shooters, clubs } from "@/lib/db/schema";
import { eq, asc, ilike, or, and, isNotNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { NOC_LIST } from "@/lib/noc-list";
import { StrelciFilterBar } from "./StrelciFilterBar";

export const metadata = { title: "Strelci" };

const PAGE_SIZE = 50;

type Props = {
  searchParams: Promise<{ q?: string; zemlja?: string; pol?: string; page?: string }>;
};

export default async function StrelciPage({ searchParams }: Props) {
  const sp = await searchParams;
  const activeQ      = sp.q?.trim() ?? "";
  const activeZemlja = sp.zemlja ?? "";
  const activePol    = sp.pol ?? "";
  const page         = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset       = (page - 1) * PAGE_SIZE;

  // Build WHERE
  const conditions: (SQL | undefined)[] = [
    activeQ
      ? or(
          ilike(shooters.firstName, `%${activeQ}%`),
          ilike(shooters.lastName,  `%${activeQ}%`),
        )
      : undefined,
    activeZemlja ? eq(shooters.nationality, activeZemlja) : undefined,
    activePol    ? eq(shooters.gender,      activePol)    : undefined,
  ].filter((c): c is SQL => c !== undefined);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, [{ totalCount }], nocRows] = await Promise.all([
    db
      .select({
        id:          shooters.id,
        firstName:   shooters.firstName,
        lastName:    shooters.lastName,
        birthYear:   shooters.birthYear,
        gender:      shooters.gender,
        verified:    shooters.verified,
        nationality: shooters.nationality,
        clubName:    clubs.name,
        clubCity:    clubs.city,
      })
      .from(shooters)
      .leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .where(where)
      .orderBy(asc(shooters.lastName), asc(shooters.firstName))
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ totalCount: sql<number>`COUNT(*)::int` })
      .from(shooters)
      .where(where),

    db
      .selectDistinct({ noc: shooters.nationality })
      .from(shooters)
      .where(isNotNull(shooters.nationality))
      .orderBy(asc(shooters.nationality)),
  ]);

  const totalPages    = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const availableNocs = nocRows.map((r) => r.noc).filter(Boolean) as string[];

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">

      {/* Header */}
      <div className="flex items-end justify-between mb-6 pb-6 border-b border-[var(--border)]">
        <h1
          className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase text-[var(--ink)]"
          style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.02em" }}
        >
          Strelci
        </h1>
      </div>

      {/* Filter bar (client) */}
      <Suspense fallback={<div className="h-20 rounded-lg bg-[var(--surface)] mb-6 animate-pulse" />}>
        <StrelciFilterBar
          availableNocs={availableNocs}
          currentQ={activeQ}
          currentZemlja={activeZemlja}
          currentPol={activePol}
          totalCount={totalCount}
          shownCount={data.length}
          page={page}
          totalPages={totalPages}
        />
      </Suspense>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {data.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-[var(--muted)]">
              {totalCount === 0
                ? "Nema strelaca za izabrane filtere."
                : "Nema rezultata na ovoj strani."}
            </p>
            {(activeQ || activeZemlja || activePol) && (
              <Link
                href="/strelci"
                className="mt-3 inline-block text-xs font-semibold text-[var(--brand-primary)] hover:underline"
              >
                Resetuj filtere
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[520px]">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <th scope="col" className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Strelac
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Zemlja
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Klub
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    God.
                  </th>
                  <th scope="col" className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {data.map((s, idx) => {
                  const alpha2 = s.nationality
                    ? NOC_LIST.find((n) => n.noc === s.nationality)?.alpha2
                    : undefined;

                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-2)] transition-colors ${
                        idx % 2 === 1 ? "bg-[var(--surface)]" : ""
                      }`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/strelci/${s.id}`}
                          className="font-semibold text-[var(--ink)] hover:text-[var(--brand-primary)] transition-colors"
                        >
                          {s.lastName} {s.firstName}
                        </Link>
                      </td>

                      {/* Nationality */}
                      <td className="px-4 py-3">
                        {s.nationality ? (
                          <span className="inline-flex items-center gap-1 font-[family-name:var(--font-jetbrains-mono)] text-[0.65rem] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)]">
                            {alpha2 && (
                              <span
                                className={`fi fi-${alpha2.toLowerCase()}`}
                                style={{ width: "14px", height: "10px", borderRadius: "1px", display: "inline-block", flexShrink: 0 }}
                              />
                            )}
                            {s.nationality}
                          </span>
                        ) : (
                          <span className="text-[var(--subtle)]">—</span>
                        )}
                      </td>

                      {/* Club */}
                      <td className="px-4 py-3 text-[var(--muted)] text-sm">
                        {s.clubName ? (
                          <>
                            {s.clubName}
                            {s.clubCity && (
                              <span className="text-[var(--subtle)] ml-1 text-xs">{s.clubCity}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-[var(--subtle)]">—</span>
                        )}
                      </td>

                      {/* Birth year */}
                      <td className="px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-[var(--muted)] text-sm tabular-nums">
                        {s.birthYear ?? <span className="text-[var(--subtle)]">—</span>}
                      </td>

                      {/* Verified badge */}
                      <td className="px-4 py-3 text-right">
                        {s.verified && (
                          <span
                            className="inline-flex items-center gap-1 text-[0.7rem] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: "var(--brand-primary-light)",
                              color: "var(--brand-primary)",
                            }}
                          >
                            ✓ Verifikovan
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </main>
  );
}
