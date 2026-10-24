import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { competitionEvents, competitions, disciplines, results, shooters } from "@shootermarkt/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export type MatchShooter = { name: string; birthYear: number | null; rank: number | null; total: string | null };
export type CompetitionMatch = {
  disciplineId: number;
  code: string;
  disciplineName: string;
  eventId: number | null;
  eventName: string | null;
  /** Datum meča: datum zasebnog meča (competition_events) ili početak takmičenja */
  date: string;
  category: string;
  /** Strelci koji su u godini meča imali najviše 20 godina (ISSF junior); bez godišta se ne broje */
  juniorAge: number;
  knownAge: number;
  shooters: MatchShooter[];
};

/** Mečevi jednog takmičenja (disciplina × zaseban meč × kategorija) sa strelcima — za izmenu kategorije u bulk editoru. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const compId = parseInt((await params).id);
  if (isNaN(compId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const rows = await db
    .select({
      disciplineId: results.disciplineId,
      code: disciplines.code,
      disciplineName: disciplines.name,
      eventId: results.competitionEventId,
      eventName: competitionEvents.name,
      date: sql<string>`coalesce(${competitionEvents.date}, ${competitions.date})`,
      category: results.category,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      birthYear: shooters.birthYear,
      rank: sql<number | null>`coalesce(${results.finalRank}, ${results.qualRank})`,
      total: results.qualTotal,
    })
    .from(results)
    .innerJoin(competitions, eq(competitions.id, results.competitionId))
    .innerJoin(disciplines, eq(disciplines.id, results.disciplineId))
    .innerJoin(shooters, eq(shooters.id, results.shooterId))
    .leftJoin(competitionEvents, eq(competitionEvents.id, results.competitionEventId))
    .where(eq(results.competitionId, compId))
    .orderBy(asc(disciplines.code), sql`coalesce(${competitionEvents.date}, ${competitions.date})`, asc(results.category), sql`coalesce(${results.finalRank}, ${results.qualRank}) nulls last`);

  const matches = new Map<string, CompetitionMatch>();
  for (const r of rows) {
    const key = `${r.disciplineId}|${r.eventId ?? ""}|${r.category}`;
    let m = matches.get(key);
    if (!m) {
      m = { disciplineId: r.disciplineId, code: r.code, disciplineName: r.disciplineName, eventId: r.eventId, eventName: r.eventName, date: r.date, category: r.category, juniorAge: 0, knownAge: 0, shooters: [] };
      matches.set(key, m);
    }
    if (r.birthYear) {
      m.knownAge++;
      if (Number(r.date.slice(0, 4)) - r.birthYear <= 20) m.juniorAge++;
    }
    m.shooters.push({ name: `${r.lastName} ${r.firstName}`, birthYear: r.birthYear, rank: r.rank, total: r.total });
  }

  return NextResponse.json({ matches: [...matches.values()] });
}
