import { db } from "@shootermarkt/db";
import { competitions, disciplines, results } from "@shootermarkt/db/schema";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { BulkEditor, type BulkRow } from "./bulk-editor";

export const metadata: Metadata = { title: "Admin · Takmičenja · Bulk izmena" };

export default async function BulkTakmicenjaPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const year = sp.year?.trim() ?? "";
  // Podrazumevano samo takmičenja sa rezultatima — samo ona utiču na formu.
  const all = sp.all === "1";

  const withResults = sql`exists (select 1 from ${results} where ${results.competitionId} = ${competitions.id})`;
  const comps = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      date: competitions.date,
      level: competitions.level,
      eventType: competitions.eventType,
      tags: competitions.tags,
    })
    .from(competitions)
    .where(and(
      q ? ilike(competitions.name, `%${q}%`) : undefined,
      year ? sql`date_part('year', ${competitions.date}::date) = ${parseInt(year)}` : undefined,
      all ? undefined : withResults,
    ))
    .orderBy(desc(competitions.date), desc(competitions.id));

  const matchRows = comps.length
    ? await db
        .select({
          competitionId: results.competitionId,
          disciplineId: results.disciplineId,
          code: disciplines.code,
          category: results.category,
          count: sql<number>`count(*)::int`,
        })
        .from(results)
        .innerJoin(disciplines, eq(disciplines.id, results.disciplineId))
        .where(inArray(results.competitionId, comps.map((c) => c.id)))
        .groupBy(results.competitionId, results.disciplineId, disciplines.code, results.category)
        .orderBy(disciplines.code, results.category)
    : [];

  const rows: BulkRow[] = comps.map((c) => ({
    ...c,
    matches: matchRows
      .filter((m) => m.competitionId === c.id)
      .map(({ disciplineId, code, category, count }) => ({ disciplineId, code, category, count })),
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/takmicenja" className="text-xs text-[var(--muted)] hover:text-[var(--ink)]">← Takmičenja</Link>
          <h1
            className="mt-1 font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
          >
            Bulk izmena
          </h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Nivo, tip i tagovi po takmičenju; kategorija po meču. Izmene se čuvaju zajedno, a forma se preračunava.
          </p>
        </div>
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <input name="q" defaultValue={q} placeholder="Naziv…" className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2" />
          <input name="year" defaultValue={year} placeholder="Godina" inputMode="numeric" className="w-24 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2" />
          <label className="flex items-center gap-1.5 text-[var(--muted)]">
            <input type="checkbox" name="all" value="1" defaultChecked={all} /> i bez rezultata
          </label>
          <button className="rounded-md border border-[var(--border-strong)] px-3 py-2 font-semibold text-[var(--ink)] hover:bg-[var(--surface)]">Filtriraj</button>
        </form>
      </div>
      <BulkEditor rows={rows} />
    </div>
  );
}
