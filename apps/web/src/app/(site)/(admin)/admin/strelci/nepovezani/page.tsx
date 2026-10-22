import { db } from "@shootermarkt/db";
import { competitions, results, shooters } from "@shootermarkt/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { UnlinkedClient, type UnlinkedRow } from "./unlinked-client";

export const metadata: Metadata = { title: "Admin · Nepovezani strelci" };

const LIMIT = 150;

export default async function UnlinkedShootersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const nat = sp.nat?.trim().toUpperCase() ?? "";
  const reviewed = sp.reviewed === "1";
  const noResults = sp.noresults === "1";

  const resultCount = sql<number>`(select count(*)::int from ${results} where ${results.shooterId} = ${shooters.id})`;
  const lastDate = sql<string | null>`(select max(${competitions.date}) from ${results} join ${competitions} on ${competitions.id} = ${results.competitionId} where ${results.shooterId} = ${shooters.id})`;

  const where = and(
    isNull(shooters.issfId),
    reviewed ? undefined : isNull(shooters.issfReviewedAt),
    noResults ? undefined : sql`exists (select 1 from ${results} where ${results.shooterId} = ${shooters.id})`,
    nat ? eq(shooters.nationality, nat) : undefined,
    ...q.split(/\s+/).filter(Boolean).map((w) => sql`(${shooters.firstName} ilike ${`%${w}%`} or ${shooters.lastName} ilike ${`%${w}%`})`),
  );

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      nationality: shooters.nationality,
      gender: shooters.gender,
      birthYear: shooters.birthYear,
      reviewed: sql<boolean>`${shooters.issfReviewedAt} is not null`,
      resultCount,
      lastDate,
    }).from(shooters).where(where).orderBy(desc(resultCount), shooters.lastName).limit(LIMIT),
    db.select({ total: sql<number>`count(*)::int` }).from(shooters).where(where),
  ]);

  const data: UnlinkedRow[] = rows.map((r) => ({ ...r, lastDate: r.lastDate ?? null }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/strelci" className="text-xs text-[var(--muted)] hover:text-[var(--ink)]">← Strelci</Link>
          <h1
            className="mt-1 font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)]"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
          >
            Nepovezani strelci
          </h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Strelci bez ISSF ID-a ({total}{total > LIMIT ? `, prikazano ${LIMIT}` : ""}). Pretraži ISSF, pa za svakog odluči: poveži sa ISSF profilom, spoji u postojećeg strelca (promena prezimena, drugačiji zapis imena) ili ostavi bez profila.
          </p>
        </div>
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <input name="q" defaultValue={q} placeholder="Ime / prezime…" className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2" />
          <input name="nat" defaultValue={nat} placeholder="NOC" maxLength={3} className="w-20 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 uppercase" />
          <label className="flex items-center gap-1.5 text-[var(--muted)]"><input type="checkbox" name="noresults" value="1" defaultChecked={noResults} /> i bez rezultata</label>
          <label className="flex items-center gap-1.5 text-[var(--muted)]"><input type="checkbox" name="reviewed" value="1" defaultChecked={reviewed} /> i pregledani</label>
          <button className="rounded-md border border-[var(--border-strong)] px-3 py-2 font-semibold text-[var(--ink)] hover:bg-[var(--surface)]">Filtriraj</button>
        </form>
      </div>
      <UnlinkedClient rows={data} />
    </div>
  );
}
