import { db } from "@shootermarkt/db";
import { competitions, countries, results } from "@shootermarkt/db/schema";
import { desc, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { BulkEditor, type BulkRow } from "./bulk-editor";
import { defaultFocusPriority } from "@/lib/competition-priority";

export const metadata: Metadata = { title: "Admin · Takmičenja · Bulk izmena" };

export default async function BulkTakmicenjaPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(sp.year ?? "") ? parseInt(sp.year) : currentYear;

  const [yearRows, comps, countryRows] = await Promise.all([
    db.selectDistinct({ year: sql<number>`date_part('year', ${competitions.date}::date)::int` }).from(competitions),
    db
      .select({
        id: competitions.id,
        name: competitions.name,
        nameSr: competitions.nameSr,
        nameEn: competitions.nameEn,
        date: competitions.date,
        dateEnd: competitions.dateEnd,
        location: competitions.location,
        locationSr: competitions.locationSr,
        locationEn: competitions.locationEn,
        countryId: competitions.countryId,
        level: competitions.level,
        eventType: competitions.eventType,
        ageCategory: competitions.ageCategory,
        focusPriority: competitions.focusPriority,
        organizer: competitions.organizer,
        issfId: competitions.issfId,
        siusId: competitions.siusId,
        sourcePdfUrl: competitions.sourcePdfUrl,
        tags: competitions.tags,
        disciplineGroups: competitions.disciplineGroups,
        timezone: competitions.timezone,
      })
      .from(competitions)
      .where(sql`date_part('year', ${competitions.date}::date) = ${year}`)
      .orderBy(desc(competitions.date), desc(competitions.id)),
    db.select({ id: countries.id, name: countries.name, code2: countries.code2, nocCode: countries.nocCode }).from(countries).orderBy(countries.name),
  ]);

  // Po takmičenju: broj mečeva (disciplina × meč × kategorija) i kategorije za auto prioritet
  const matchRows = comps.length
    ? await db
        .select({
          competitionId: results.competitionId,
          categories: sql<string[]>`array_agg(distinct ${results.category})`,
          matchCount: sql<number>`count(distinct (${results.disciplineId}, ${results.competitionEventId}, ${results.category}))::int`,
          resultCount: sql<number>`count(*)::int`,
        })
        .from(results)
        .where(inArray(results.competitionId, comps.map((c) => c.id)))
        .groupBy(results.competitionId)
    : [];
  const matchesBy = new Map(matchRows.map((m) => [m.competitionId, m]));

  const rows: BulkRow[] = comps.map((c) => {
    const m = matchesBy.get(c.id);
    return {
      ...c,
      autoPriority: defaultFocusPriority({ name: c.name, level: c.level, eventType: c.eventType, ageCategory: c.ageCategory }, m?.categories ?? []),
      matchCount: m?.matchCount ?? 0,
      resultCount: m?.resultCount ?? 0,
    };
  });

  const years = [...new Set([currentYear, year, ...yearRows.map((r) => r.year)])].sort((a, b) => b - a);

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/takmicenja" className="text-xs text-[var(--muted)] hover:text-[var(--ink)]">← Takmičenja</Link>
        <h1
          className="mt-1 font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
          style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
        >
          Kalendar takmičenja
        </h1>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          Pregled po godini. „Izmeni“ otvara sva polja takmičenja i njegove mečeve; ništa se ne upisuje dok ne klikneš „Sačuvaj u bazu“.
        </p>
      </div>
      <BulkEditor key={year} rows={rows} year={year} years={years} countries={countryRows} />
    </div>
  );
}
