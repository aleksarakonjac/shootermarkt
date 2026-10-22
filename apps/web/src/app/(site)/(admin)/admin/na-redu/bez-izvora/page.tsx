import { db } from "@shootermarkt/db";
import { competitions, competitionSchedule } from "@shootermarkt/db/schema";
import { asc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { missingSourceWhere } from "@/lib/admin-todo";
import { CompetitionSources } from "../competition-sources";

export const metadata: Metadata = { title: "Admin — Bez izvora za live" };

export default async function MissingSourcePage() {
  const rows = await db
    .select({
      id: competitions.id, name: competitions.name, date: competitions.date, dateEnd: competitions.dateEnd,
      location: competitions.location, level: competitions.level, siusId: competitions.siusId, issfId: competitions.issfId,
      slots: sql<number>`(select count(*)::int from ${competitionSchedule} where ${competitionSchedule}.competition_id = "competitions"."id")`,
    })
    .from(competitions)
    .where(missingSourceWhere())
    .orderBy(asc(competitions.date));

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <Link href="/admin" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Pregled</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink)]">Međunarodna takmičenja bez izvora za live</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {rows.length} u narednih 30 dana bez SIUS UUID-a i ISSF ID-a. ISSF ID je broj iz URL-a na issf-sports.org/competitions/<strong>3277</strong>. Satnicu dodaješ u uređivanju takmičenja.
        </p>
      </header>
      {rows.length === 0
        ? <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-sm text-[var(--muted)]">Sva predstojeća međunarodna takmičenja imaju izvor.</p>
        : <CompetitionSources rows={rows} />}
    </div>
  );
}
