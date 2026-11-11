import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { disciplines, olympicQuotaAllocations, olympicQuotas, results, shooters } from "@shootermarkt/db/schema";
import { and, asc, count, eq, isNotNull, or } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

const GAMES = "LA2028";

// Discipline koje ne dele olimpijske kvote: ESC solo, 300m, mešoviti timovi, juniorske varijante.
const NON_OLYMPIC = /^(SOLO|R3P300|RPR300|STR300|ARMT|APMT|R3J)/;

export type QuotaFinalist = {
  resultId: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  finalRank: number | null;
  quota: boolean;
};

export type QuotaDiscipline = {
  disciplineId: number;
  code: string;
  name: string;
  places: number;
  finalists: QuotaFinalist[];
};

export type QuotaData = {
  disciplines: QuotaDiscipline[];
  /** Discipline za koje takmičenje još nema alokaciju kvota. */
  available: Array<{ id: number; code: string; name: string }>;
};

type Ctx = { params: Promise<{ id: string }> };

const parseId = async (ctx: Ctx) => {
  const id = parseInt((await ctx.params).id);
  return isNaN(id) ? null : id;
};

/** Alokacije kvota takmičenja, finalisti tih disciplina (sa oznakom kvote) i discipline koje se još mogu dodati. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const compId = await parseId(ctx);
  if (compId == null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [allocations, allDisciplines, rows] = await Promise.all([
    db
      .select({ disciplineId: olympicQuotaAllocations.disciplineId, places: olympicQuotaAllocations.places, code: disciplines.code, name: disciplines.name })
      .from(olympicQuotaAllocations)
      .innerJoin(disciplines, eq(disciplines.id, olympicQuotaAllocations.disciplineId))
      .where(and(eq(olympicQuotaAllocations.competitionId, compId), eq(olympicQuotaAllocations.games, GAMES)))
      .orderBy(asc(disciplines.code)),
    db.select({ id: disciplines.id, code: disciplines.code, name: disciplines.name }).from(disciplines).orderBy(asc(disciplines.code)),
    db
      .select({
        resultId: results.id,
        disciplineId: results.disciplineId,
        firstName: shooters.firstName,
        lastName: shooters.lastName,
        nationality: shooters.nationality,
        finalRank: results.finalRank,
        quotaId: olympicQuotas.id,
      })
      .from(results)
      .innerJoin(shooters, eq(shooters.id, results.shooterId))
      .leftJoin(olympicQuotas, and(eq(olympicQuotas.resultId, results.id), eq(olympicQuotas.games, GAMES)))
      // Kvote se osvajaju u seniorskoj konkurenciji; finalista ima plasman u finalu.
      .where(and(eq(results.competitionId, compId), eq(results.category, "senior"), or(isNotNull(results.finalRank), isNotNull(olympicQuotas.id))))
      .orderBy(asc(results.finalRank)),
  ]);

  const allocated = new Set(allocations.map((a) => a.disciplineId));
  const data: QuotaData = {
    disciplines: allocations.map((a) => ({
      ...a,
      finalists: rows
        .filter((r) => r.disciplineId === a.disciplineId)
        .map(({ disciplineId: _d, quotaId, ...f }) => ({ ...f, quota: quotaId != null })),
    })),
    available: allDisciplines.filter((d) => !allocated.has(d.id) && !NON_OLYMPIC.test(d.code)),
  };
  return NextResponse.json(data);
}

/** Uključuje/isključuje kvotu na rezultatu ({ resultId, quota }). Disciplina mora imati alokaciju i slobodno mesto. */
export const POST = revalidatesPublicSite(async (req: NextRequest, ctx: Ctx) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const compId = await parseId(ctx);
  const body = (await req.json().catch(() => null)) as { resultId?: unknown; quota?: unknown } | null;
  const resultId = Number(body?.resultId);
  if (compId == null || !Number.isInteger(resultId) || typeof body?.quota !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const [row] = await db
    .select({ disciplineId: results.disciplineId })
    .from(results)
    .where(and(eq(results.id, resultId), eq(results.competitionId, compId)));
  if (!row) return NextResponse.json({ error: "Rezultat ne pripada ovom takmičenju" }, { status: 404 });

  if (!body.quota) {
    await db.delete(olympicQuotas).where(and(eq(olympicQuotas.resultId, resultId), eq(olympicQuotas.games, GAMES)));
    return NextResponse.json({ ok: true });
  }

  const [allocation] = await db
    .select({ places: olympicQuotaAllocations.places })
    .from(olympicQuotaAllocations)
    .where(and(eq(olympicQuotaAllocations.competitionId, compId), eq(olympicQuotaAllocations.disciplineId, row.disciplineId), eq(olympicQuotaAllocations.games, GAMES)));
  if (!allocation) return NextResponse.json({ error: "Ova disciplina nema alokaciju kvota na ovom takmičenju" }, { status: 409 });

  const [{ used }] = await db
    .select({ used: count() })
    .from(olympicQuotas)
    .innerJoin(results, eq(results.id, olympicQuotas.resultId))
    .where(and(eq(results.competitionId, compId), eq(results.disciplineId, row.disciplineId), eq(olympicQuotas.games, GAMES)));
  if (used >= allocation.places) return NextResponse.json({ error: `Sva mesta (${allocation.places}) su već dodeljena` }, { status: 409 });

  await db.insert(olympicQuotas).values({ resultId, games: GAMES }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
});

/** Postavlja broj kvota discipline na takmičenju ({ disciplineId, places }); ne može ispod već dodeljenih. */
export const PUT = revalidatesPublicSite(async (req: NextRequest, ctx: Ctx) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const compId = await parseId(ctx);
  const body = (await req.json().catch(() => null)) as { disciplineId?: unknown; places?: unknown } | null;
  const disciplineId = Number(body?.disciplineId);
  const places = Number(body?.places);
  if (compId == null || !Number.isInteger(disciplineId) || !Number.isInteger(places) || places < 1 || places > 20) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const [discipline] = await db.select({ code: disciplines.code }).from(disciplines).where(eq(disciplines.id, disciplineId));
  if (!discipline || NON_OLYMPIC.test(discipline.code)) return NextResponse.json({ error: "Disciplina ne deli olimpijske kvote" }, { status: 400 });

  const [{ used }] = await db
    .select({ used: count() })
    .from(olympicQuotas)
    .innerJoin(results, eq(results.id, olympicQuotas.resultId))
    .where(and(eq(results.competitionId, compId), eq(results.disciplineId, disciplineId), eq(olympicQuotas.games, GAMES)));
  if (places < used) return NextResponse.json({ error: `Već je dodeljeno ${used} kvota` }, { status: 409 });

  await db
    .insert(olympicQuotaAllocations)
    .values({ competitionId: compId, disciplineId, games: GAMES, places })
    .onConflictDoUpdate({ target: [olympicQuotaAllocations.competitionId, olympicQuotaAllocations.disciplineId, olympicQuotaAllocations.games], set: { places } });
  return NextResponse.json({ ok: true });
});

/** Uklanja alokaciju discipline ({ disciplineId }); samo ako nijedna kvota nije dodeljena. */
export const DELETE = revalidatesPublicSite(async (req: NextRequest, ctx: Ctx) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const compId = await parseId(ctx);
  const body = (await req.json().catch(() => null)) as { disciplineId?: unknown } | null;
  const disciplineId = Number(body?.disciplineId);
  if (compId == null || !Number.isInteger(disciplineId)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const [{ used }] = await db
    .select({ used: count() })
    .from(olympicQuotas)
    .innerJoin(results, eq(results.id, olympicQuotas.resultId))
    .where(and(eq(results.competitionId, compId), eq(results.disciplineId, disciplineId), eq(olympicQuotas.games, GAMES)));
  if (used > 0) return NextResponse.json({ error: "Prvo ukloni dodeljene kvote" }, { status: 409 });

  await db
    .delete(olympicQuotaAllocations)
    .where(and(eq(olympicQuotaAllocations.competitionId, compId), eq(olympicQuotaAllocations.disciplineId, disciplineId), eq(olympicQuotaAllocations.games, GAMES)));
  return NextResponse.json({ ok: true });
});
