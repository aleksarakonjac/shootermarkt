import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { competitionEvents, competitions, disciplines, mixedTeamResults, results, teamResults } from "@shootermarkt/db/schema";
import { and, asc, count, eq, isNull, notExists, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { recomputeFormaCache } from "@/lib/forma-cache";
import { refreshDisciplineGroups } from "@/lib/discipline-groups";
import { revalidatesPublicSite } from "@/lib/revalidate-public";
import { noFinalKey } from "@/lib/final-medals";

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
  /** Admin oznaka "nema finala"; samo pojedinačni rezultati. */
  noFinal?: boolean;
};

/** Rezultati jednog takmičenja grupisani: disciplina × zaseban meč × kategorija (pojedinačno i mešoviti tim). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const compId = parseInt((await params).id);
  if (isNaN(compId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [[comp], individual, mixed] = await Promise.all([
    db.select({ noFinalGroups: competitions.noFinalGroups }).from(competitions).where(eq(competitions.id, compId)),
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
        eventId: mixedTeamResults.competitionEventId,
        eventName: competitionEvents.name,
        eventDate: competitionEvents.date,
        category: mixedTeamResults.category,
        count: count(),
      })
      .from(mixedTeamResults)
      .innerJoin(disciplines, eq(disciplines.id, mixedTeamResults.disciplineId))
      .leftJoin(competitionEvents, eq(competitionEvents.id, mixedTeamResults.competitionEventId))
      .where(eq(mixedTeamResults.competitionId, compId))
      .groupBy(mixedTeamResults.disciplineId, disciplines.code, disciplines.name, mixedTeamResults.competitionEventId, competitionEvents.name, competitionEvents.date, mixedTeamResults.category)
      .orderBy(asc(disciplines.code), asc(competitionEvents.date), asc(mixedTeamResults.category)),
  ]);

  const groups: CompetitionResultGroup[] = [
    ...individual.map((r) => ({ kind: "individual" as const, ...r, noFinal: comp?.noFinalGroups.includes(noFinalKey(r.code, r.eventId, r.category)) ?? false })),
    ...mixed.map((r) => ({ kind: "mixed" as const, ...r })),
  ];
  return NextResponse.json({ groups });
}

/** Zasebni mečevi (competition_events) bez ijednog pojedinačnog rezultata i mik tima više nemaju smisla. */
async function deleteEmptyEvents(compId: number) {
  await db.delete(competitionEvents).where(and(
    eq(competitionEvents.competitionId, compId),
    notExists(db.select({ one: sql`1` }).from(results).where(eq(results.competitionEventId, competitionEvents.id))),
    notExists(db.select({ one: sql`1` }).from(mixedTeamResults).where(eq(mixedTeamResults.competitionEventId, competitionEvents.id))),
    notExists(db.select({ one: sql`1` }).from(teamResults).where(eq(teamResults.competitionEventId, competitionEvents.id))),
  ));
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

  const hasEvent = body && "eventId" in body;
  const eventId: number | null = hasEvent && body.eventId != null ? Number(body.eventId) : null;
  if (hasEvent && body.eventId != null && !Number.isInteger(eventId)) {
    return NextResponse.json({ error: "Neispravan meč" }, { status: 400 });
  }

  if (body?.kind === "mixed") {
    const deleted = await db
      .delete(mixedTeamResults)
      .where(and(
        eq(mixedTeamResults.competitionId, compId),
        eq(mixedTeamResults.disciplineId, disciplineId),
        hasEvent ? (eventId === null ? isNull(mixedTeamResults.competitionEventId) : eq(mixedTeamResults.competitionEventId, eventId)) : undefined,
        category ? eq(mixedTeamResults.category, category as never) : undefined,
      ))
      .returning({ id: mixedTeamResults.id });
    await deleteEmptyEvents(compId);
    await refreshDisciplineGroups(compId);
    return NextResponse.json({ deleted: deleted.length });
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

  // ekipni plasman iste discipline ide zajedno sa pojedinačnim
  await db.delete(teamResults).where(and(
    eq(teamResults.competitionId, compId),
    eq(teamResults.disciplineId, disciplineId),
    hasEvent ? (eventId === null ? isNull(teamResults.competitionEventId) : eq(teamResults.competitionEventId, eventId)) : undefined,
    category ? eq(teamResults.category, category as never) : undefined,
  ));

  await deleteEmptyEvents(compId);

  await refreshDisciplineGroups(compId);
  await recomputeFormaCache([...new Set(deleted.map((row) => row.shooterId))]);

  return NextResponse.json({ deleted: deleted.length });
}

export const DELETE = revalidatesPublicSite(handleDELETE);

/** Uključuje/isključuje oznaku "nema finala" za jednu grupu. Body: { key: "ARM|senior" | "ARM@12|senior", noFinal } */
async function handlePATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const compId = parseInt((await params).id);
  if (isNaN(compId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const key: unknown = body?.key;
  if (typeof key !== "string" || key.length > 40 || !/^[A-Z0-9]+(@\d+)?\|[a-z0-9_]+$/.test(key) || typeof body.noFinal !== "boolean") {
    return NextResponse.json({ error: "Neispravan zahtev" }, { status: 400 });
  }

  // jedan UPDATE: remove pa append, bez duplikata i bez trke između dva klika
  const without = sql`array_remove(${competitions.noFinalGroups}, ${key}::varchar)`;
  const updated = await db
    .update(competitions)
    .set({ noFinalGroups: body.noFinal ? sql`array_append(${without}, ${key}::varchar)` : without })
    .where(eq(competitions.id, compId))
    .returning({ id: competitions.id });
  if (!updated.length) return NextResponse.json({ error: "Takmičenje ne postoji" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export const PATCH = revalidatesPublicSite(handlePATCH);
