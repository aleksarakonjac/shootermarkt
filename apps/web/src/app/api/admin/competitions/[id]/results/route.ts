import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { competitionEvents, disciplines, mixedTeamResults, results } from "@shootermarkt/db/schema";
import { and, asc, count, eq, isNull, notExists, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { recomputeFormaCache } from "@/lib/forma-cache";
import { refreshDisciplineGroups } from "@/lib/discipline-groups";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

export type CompetitionResultGroup = {
  kind: "individual" | "mixed";
  disciplineId: number;
  code: string;
  disciplineName: string;
  eventId: number | null;
  eventName: string | null;
  eventDate: string | null;
  category: string;
  count: number;
};

/** Rezultati jednog takmičenja grupisani: disciplina × zaseban meč × kategorija (pojedinačno i mešoviti tim). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const compId = parseInt((await params).id);
  if (isNaN(compId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [individual, mixed] = await Promise.all([
    db
      .select({
        disciplineId: results.disciplineId,
        code: disciplines.code,
        disciplineName: disciplines.name,
        eventId: results.competitionEventId,
        eventName: competitionEvents.name,
        eventDate: competitionEvents.date,
        category: results.category,
        count: count(),
      })
      .from(results)
      .innerJoin(disciplines, eq(disciplines.id, results.disciplineId))
      .leftJoin(competitionEvents, eq(competitionEvents.id, results.competitionEventId))
      .where(eq(results.competitionId, compId))
      .groupBy(results.disciplineId, disciplines.code, disciplines.name, results.competitionEventId, competitionEvents.name, competitionEvents.date, results.category)
      .orderBy(asc(disciplines.code), asc(competitionEvents.date), asc(results.category)),
    db
      .select({
        disciplineId: mixedTeamResults.disciplineId,
        code: disciplines.code,
        disciplineName: disciplines.name,
        category: mixedTeamResults.category,
        count: count(),
      })
      .from(mixedTeamResults)
      .innerJoin(disciplines, eq(disciplines.id, mixedTeamResults.disciplineId))
      .where(eq(mixedTeamResults.competitionId, compId))
      .groupBy(mixedTeamResults.disciplineId, disciplines.code, disciplines.name, mixedTeamResults.category)
      .orderBy(asc(disciplines.code), asc(mixedTeamResults.category)),
  ]);

  const groups: CompetitionResultGroup[] = [
    ...individual.map((r) => ({ kind: "individual" as const, ...r })),
    ...mixed.map((r) => ({ kind: "mixed" as const, ...r, eventId: null, eventName: null, eventDate: null })),
  ];
  return NextResponse.json({ groups });
}

/**
 * Briše rezultate jedne discipline (opciono samo jedan meč i/ili kategoriju) iz takmičenja.
 * Body: { kind, disciplineId, eventId?: number | null, category?: string }
 *   eventId izostavljen → svi mečevi discipline; eventId null → samo rezultati bez zasebnog meča.
 */
async function handleDELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const compId = parseInt((await params).id);
  if (isNaN(compId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const disciplineId = Number(body?.disciplineId);
  if (!Number.isInteger(disciplineId)) return NextResponse.json({ error: "Disciplina je obavezna" }, { status: 400 });
  const category: string | undefined = typeof body?.category === "string" ? body.category : undefined;

  if (body?.kind === "mixed") {
    const deleted = await db
      .delete(mixedTeamResults)
      .where(and(
        eq(mixedTeamResults.competitionId, compId),
        eq(mixedTeamResults.disciplineId, disciplineId),
        category ? eq(mixedTeamResults.category, category as never) : undefined,
      ))
      .returning({ id: mixedTeamResults.id });
    await refreshDisciplineGroups(compId);
    return NextResponse.json({ deleted: deleted.length });
  }

  const hasEvent = body && "eventId" in body;
  const eventId: number | null = hasEvent && body.eventId != null ? Number(body.eventId) : null;
  if (hasEvent && body.eventId != null && !Number.isInteger(eventId)) {
    return NextResponse.json({ error: "Neispravan meč" }, { status: 400 });
  }

  const deleted = await db
    .delete(results)
    .where(and(
      eq(results.competitionId, compId),
      eq(results.disciplineId, disciplineId),
      hasEvent ? (eventId === null ? isNull(results.competitionEventId) : eq(results.competitionEventId, eventId)) : undefined,
      category ? eq(results.category, category as never) : undefined,
    ))
    .returning({ shooterId: results.shooterId });

  // Zasebni mečevi (competition_events) bez ijednog rezultata više nemaju smisla.
  await db.delete(competitionEvents).where(and(
    eq(competitionEvents.competitionId, compId),
    notExists(db.select({ one: sql`1` }).from(results).where(eq(results.competitionEventId, competitionEvents.id))),
  ));

  await refreshDisciplineGroups(compId);
  await recomputeFormaCache([...new Set(deleted.map((row) => row.shooterId))]);

  return NextResponse.json({ deleted: deleted.length });
}

export const DELETE = revalidatesPublicSite(handleDELETE);
