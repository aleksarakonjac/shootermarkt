import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { asc, desc, sql } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { TranslationsClient } from "./translations-client";

export const metadata: Metadata = { title: "Admin · Takmičenja · Prevodi" };

export default async function PrevodiPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const yearRows = await db
    .selectDistinct({ year: sql<number>`date_part('year', ${competitions.date}::date)::int` })
    .from(competitions)
    .orderBy(sql`1 desc`);
  const years = yearRows.map((r) => r.year);
  const year = parseInt(sp.year ?? "") || years[0] || new Date().getFullYear();

  const rows = await db
    .select({
      id: competitions.id,
      date: competitions.date,
      name: competitions.name,
      nameSr: competitions.nameSr,
      nameEn: competitions.nameEn,
      location: competitions.location,
      locationSr: competitions.locationSr,
      locationEn: competitions.locationEn,
    })
    .from(competitions)
    .where(sql`date_part('year', ${competitions.date}::date) = ${year}`)
    .orderBy(asc(competitions.date), desc(competitions.id));

  return (
    <div>
      <Link href={`/admin/takmicenja?year=${year}`} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Takmičenja</Link>
      <h1
        className="font-[family-name:var(--font-barlow-condensed)] font-extrabold uppercase tracking-tight text-[var(--ink)] mt-2 mb-6"
        style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.02em" }}
      >
        Prevodi takmičenja
      </h1>
      <TranslationsClient key={year} year={year} years={years} initialRows={rows} />
    </div>
  );
}
