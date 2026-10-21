import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { ageCategoryEnum, competitionLevelEnum, competitions, eventTypeEnum, results } from "@shootermarkt/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { recomputeFormaCache } from "@/lib/forma-cache";
import { requireAdmin } from "@/lib/admin-auth";

type Level = (typeof competitionLevelEnum.enumValues)[number];
type EventType = (typeof eventTypeEnum.enumValues)[number];
type Category = (typeof ageCategoryEnum.enumValues)[number];

export type BulkCompetitionChange = { id: number; level?: Level; eventType?: EventType; tags?: string[] };
/** Svi rezultati meča (takmičenje × disciplina × kategorija) prelaze u novu kategoriju. */
export type BulkMatchChange = { competitionId: number; disciplineId: number; from: Category; to: Category };

const isIn = <T extends string>(values: readonly T[], v: unknown): v is T => typeof v === "string" && values.includes(v as T);
const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

/**
 * Bulk izmena takmičenja iz admin liste: level / event_type / tagovi po takmičenju i kategorija
 * po meču. Sve u jednoj transakciji; posle upisa se preračunava forma pogođenih strelaca
 * (level, event_type i kategorija ulaze u težinu forme).
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const comps: unknown[] = Array.isArray(body?.competitions) ? body.competitions : [];
  const matches: unknown[] = Array.isArray(body?.matches) ? body.matches : [];

  const compChanges: BulkCompetitionChange[] = [];
  for (const raw of comps) {
    const c = raw as Record<string, unknown>;
    if (!isId(c.id)) return NextResponse.json({ error: "Neispravan id takmičenja" }, { status: 400 });
    if (c.level !== undefined && !isIn(competitionLevelEnum.enumValues, c.level)) return NextResponse.json({ error: `[${c.id}] nepoznat nivo` }, { status: 400 });
    if (c.eventType !== undefined && !isIn(eventTypeEnum.enumValues, c.eventType)) return NextResponse.json({ error: `[${c.id}] nepoznat tip` }, { status: 400 });
    if (c.tags !== undefined && !(Array.isArray(c.tags) && c.tags.every((t) => typeof t === "string" && t.trim() && t.length <= 20))) {
      return NextResponse.json({ error: `[${c.id}] tag mora imati 1–20 znakova` }, { status: 400 });
    }
    compChanges.push({
      id: c.id,
      level: c.level as Level | undefined,
      eventType: c.eventType as EventType | undefined,
      tags: (c.tags as string[] | undefined)?.map((t) => t.trim()),
    });
  }

  const matchChanges: BulkMatchChange[] = [];
  for (const raw of matches) {
    const m = raw as Record<string, unknown>;
    if (!isId(m.competitionId) || !isId(m.disciplineId) || !isIn(ageCategoryEnum.enumValues, m.from) || !isIn(ageCategoryEnum.enumValues, m.to)) {
      return NextResponse.json({ error: "Neispravna izmena kategorije meča" }, { status: 400 });
    }
    if (m.from !== m.to) matchChanges.push({ competitionId: m.competitionId, disciplineId: m.disciplineId, from: m.from, to: m.to });
  }

  if (compChanges.length === 0 && matchChanges.length === 0) return NextResponse.json({ updated: 0 });

  try {
    await db.transaction(async (tx) => {
      for (const c of compChanges) {
        const set = {
          ...(c.level ? { level: c.level } : {}),
          ...(c.eventType ? { eventType: c.eventType } : {}),
          ...(c.tags ? { tags: c.tags } : {}),
        };
        if (Object.keys(set).length) await tx.update(competitions).set(set).where(eq(competitions.id, c.id));
      }
      for (const m of matchChanges) {
        await tx.update(results).set({ category: m.to }).where(and(
          eq(results.competitionId, m.competitionId),
          eq(results.disciplineId, m.disciplineId),
          eq(results.category, m.from),
        ));
      }
    });
  } catch (e) {
    // results unique (strelac, takmičenje, disciplina, kategorija): ciljna kategorija već ima istog strelca
    if ((e as { cause?: { code?: string } }).cause?.code === "23505" || (e as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Neki strelac već ima rezultat u ciljnoj kategoriji tog meča — ništa nije sačuvano." }, { status: 409 });
    }
    throw e;
  }

  const touched = [...new Set([...compChanges.map((c) => c.id), ...matchChanges.map((m) => m.competitionId)])];
  const shooterRows = await db.selectDistinct({ shooterId: results.shooterId }).from(results).where(inArray(results.competitionId, touched));
  await recomputeFormaCache(shooterRows.map((r) => r.shooterId));

  return NextResponse.json({ updated: compChanges.length + matchChanges.length });
}
