import { db } from "@shootermarkt/db";
import { competitions, competitionSchedule } from "@shootermarkt/db/schema";
import { desc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { unresolvedWhere } from "@/lib/admin-todo";
import { CompetitionSources } from "../competition-sources";

export const metadata: Metadata = { title: "Admin — Završena bez rezultata" };

export default async function UnresolvedPage() {
  const rows = await db
    .select({
      id: competitions.id, name: competitions.name, date: competitions.date, dateEnd: competitions.dateEnd,
      location: competitions.location, level: competitions.level, siusId: competitions.siusId, issfId: competitions.issfId,
      slots: sql<number>`(select count(*)::int from ${competitionSchedule} where ${competitionSchedule}.competition_id = "competitions"."id")`,
    })
    .from(competitions)
    .where(unresolvedWhere())
    .orderBy(desc(competitions.date));

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <Link href="/admin" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">← Pregled</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink)]">Završena takmičenja bez rezultata</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {rows.length} u poslednjih 60 dana. Upiši SIUS/ISSF ID da live-fetch može da povuče rezultate, ili uvezi bilten ručno. Ako je takmičenje otkazano ili pogrešno uneto, otvori ga (klik na naziv) i obriši.
        </p>
      </header>
      {rows.length === 0
        ? <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-sm text-[var(--muted)]">Sva završena takmičenja imaju rezultate.</p>
        : <CompetitionSources rows={rows} importLink />}
    </div>
  );
}
