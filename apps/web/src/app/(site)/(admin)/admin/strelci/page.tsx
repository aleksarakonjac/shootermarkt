import { db } from "@shootermarkt/db";
import { shooters, clubs, countries } from "@shootermarkt/db/schema";
import { eq, and, isNotNull, sql, asc, desc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { buildShootersWhere } from "@/lib/admin-shooters-filter";
import { matchedPreviousLastName } from "@/lib/previous-last-name";
import { StrelciClient } from "./strelci-client";
import { StrelciFilters } from "./strelci-filters";

export const metadata: Metadata = { title: "Admin · Strelci" };

const PAGE_SIZE = 50;

export default async function AdminStrelciPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const gender = sp.gender?.trim() ?? "";
  const apparatus = sp.apparatus?.trim() ?? "";
  const onlyUnverified = sp.verified === "0";
  const sortCol = sp.sort ?? "name";
  const sortDir = sp.dir === "desc" ? "desc" : "asc";

  const where = buildShootersWhere(sp);

  const orderBy = (() => {
    const d = sortDir === "desc";
    switch (sortCol) {
      case "country":   return [d ? desc(shooters.nationality) : asc(shooters.nationality)];
      case "gender":    return [d ? desc(shooters.gender) : asc(shooters.gender), asc(shooters.lastName)];
      case "apparatus": return [d ? desc(shooters.apparatus) : asc(shooters.apparatus), asc(shooters.lastName)];
      case "birthDate": return [d ? desc(shooters.birthDate) : asc(shooters.birthDate)];
      default:          return [d ? desc(shooters.lastName) : asc(shooters.lastName), d ? desc(shooters.firstName) : asc(shooters.firstName)];
    }
  })();

  const [data, [{ total }], [{ unverifiedTotal }], nats] = await Promise.all([
    db
      .select({
        id: shooters.id,
        firstName: shooters.firstName,
        lastName: shooters.lastName,
        previousLastNames: shooters.previousLastNames,
        nationality: shooters.nationality,
        countryName: countries.name,
        verified: shooters.verified,
        createdBySelf: shooters.createdBySelf,
        issfId: shooters.issfId,
        clubName: clubs.name,
        birthDate: shooters.birthDate,
        birthYear: shooters.birthYear,
        avatarUrl: shooters.avatarUrl,
        apparatus: shooters.apparatus,
        gender: shooters.gender,
      })
      .from(shooters)
      .leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .leftJoin(countries, eq(shooters.nationality, countries.code))
      .where(where)
      .orderBy(...orderBy)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(shooters)
      .where(where),
    db
      .select({ unverifiedTotal: sql<number>`count(*)::int` })
      .from(shooters)
      .where(and(where, eq(shooters.verified, false))),
    db
      .selectDistinct({
        code: shooters.nationality,
        name: countries.name,
      })
      .from(shooters)
      .leftJoin(countries, eq(shooters.nationality, countries.code))
      .where(isNotNull(shooters.nationality))
      .orderBy(shooters.nationality),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-6">
        <div>
          <h1
            className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
          >
            Strelci
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">prikazano {data.length} od {total}</p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <div className="mb-4">
        <StrelciFilters
          nationalities={nats.map((n) => ({ code: n.code!, name: n.name ?? n.code! }))}
          onlyUnverified={onlyUnverified}
          gender={gender}
          apparatus={apparatus}
        />
      </div>

      <StrelciClient
        data={data.map(({ previousLastNames, ...s }) => ({
          ...s,
          matchedLastName: sp.q ? matchedPreviousLastName(sp.q, s.firstName, s.lastName, previousLastNames) : null,
        }))}
        page={page}
        total={total}
        unverifiedTotal={unverifiedTotal}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
