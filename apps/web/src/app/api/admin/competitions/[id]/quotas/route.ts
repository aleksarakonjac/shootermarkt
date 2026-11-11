import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { disciplines, olympicQuotaAllocations, olympicQuotas, results, shooters } from "@shootermarkt/db/schema";
import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import { assignQuotas, MAX_QUOTAS_PER_NOC, type QuotaBasis } from "@/lib/quota-assign";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

const GAMES = "LA2028";

// Discipline koje ne dele olimpijske kvote: ESC solo, 300m, ležeći (prone), standardni pištolj, 25m sportski (SPM) i slobodni pištolj (FPM) za muškarce, mešoviti timovi, juniorske varijante.
const NON_OLYMPIC = /^(SOLO|R3P300|RPR|STR300|STP|SPM|FPM|ARMT|APMT|R3J)/;

const isBasis = (v: unknown): v is QuotaBasis => v === "final" || v === "qualification";
const rankColumn = (basis: QuotaBasis) => (basis === "qualification" ? results.qualRank : results.finalRank);

export type QuotaCandidateRow = {
  resultId: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  rank: number | null;
  quota: boolean;
};

export type QuotaDiscipline = {
  disciplineId: number;
  code: string;
  name: string;
  places: number;
  basis: QuotaBasis;
  candidates: QuotaCandidateRow[];
  /** Koliko kvota u ovoj disciplini već ima svaki NOC (kroz sva takmičenja). */
  nocCounts: Array<{ noc: string; count: number }>;
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

/** Sve dodeljene kvote (nekoliko stotina redova najviše) sa strelcem, državom, disciplinom i takmičenjem. */
async function allHoldings() {
  return db
    .select({ shooterId: results.shooterId, competitionId: results.competitionId, disciplineId: results.disciplineId, noc: shooters.nationality })
    .from(olympicQuotas)
    .innerJoin(results, eq(results.id, olympicQuotas.resultId))
    .innerJoin(shooters, eq(shooters.id, results.shooterId))
    .where(eq(olympicQuotas.games, GAMES));
}
type Holding = Awaited<ReturnType<typeof allHoldings>>[number];

/** Stanje kvota jedne discipline na jednom takmičenju, izvedeno iz svih dodeljenih kvota. */
function holdingsFor(all: Holding[], compId: number, disciplineId: number) {
  const inDiscipline = all.filter((h) => h.disciplineId === disciplineId);
  const nocCounts = new Map<string, number>();
  for (const h of inDiscipline) if (h.noc) nocCounts.set(h.noc, (nocCounts.get(h.noc) ?? 0) + 1);
  const here = inDiscipline.filter((h) => h.competitionId === compId);
  return {
    shooterIds: new Set(all.map((h) => h.shooterId)),
    nocCounts,
    eventNocs: new Set(here.flatMap((h) => (h.noc ? [h.noc] : []))),
    used: here.length,
  };
}

async function getAllocation(compId: number, disciplineId: number) {
  const [row] = await db
    .select({ places: olympicQuotaAllocations.places, basis: olympicQuotaAllocations.basis })
    .from(olympicQuotaAllocations)
    .where(and(eq(olympicQuotaAllocations.competitionId, compId), eq(olympicQuotaAllocations.disciplineId, disciplineId), eq(olympicQuotaAllocations.games, GAMES)));
  return row ? { places: row.places, basis: row.basis as QuotaBasis } : null;
}

/** Alokacije kvota takmičenja, kandidati tih disciplina (sa oznakom kvote) i discipline koje se još mogu dodati. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const compId = await parseId(ctx);
  if (compId == null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [allocations, allDisciplines, rows, holdings] = await Promise.all([
    db
      .select({ disciplineId: olympicQuotaAllocations.disciplineId, places: olympicQuotaAllocations.places, basis: olympicQuotaAllocations.basis, code: disciplines.code, name: disciplines.name })
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
        qualRank: results.qualRank,
        quotaId: olympicQuotas.id,
      })
      .from(results)
      .innerJoin(shooters, eq(shooters.id, results.shooterId))
      .leftJoin(olympicQuotas, and(eq(olympicQuotas.resultId, results.id), eq(olympicQuotas.games, GAMES)))
      // Kvote se osvajaju u seniorskoj konkurenciji; kandidat ima plasman po kom se kvote dele (ili već ima kvotu).
      .where(and(eq(results.competitionId, compId), eq(results.category, "senior"), or(isNotNull(results.finalRank), isNotNull(results.qualRank), isNotNull(olympicQuotas.id))))
      .orderBy(asc(results.finalRank), asc(results.qualRank)),
    allHoldings(),
  ]);

  const allocated = new Set(allocations.map((a) => a.disciplineId));
  const data: QuotaData = {
    disciplines: allocations.map((a) => {
      const basis = a.basis as QuotaBasis;
      const nocCounts = [...holdingsFor(holdings, compId, a.disciplineId).nocCounts].map(([noc, count]) => ({ noc, count }));
      return {
        disciplineId: a.disciplineId,
        code: a.code,
        name: a.name,
        places: a.places,
        basis,
        candidates: rows
          .filter((r) => r.disciplineId === a.disciplineId)
          .map((r) => ({ resultId: r.resultId, firstName: r.firstName, lastName: r.lastName, nationality: r.nationality, rank: basis === "qualification" ? r.qualRank : r.finalRank, quota: r.quotaId != null }))
          .filter((r) => r.rank != null || r.quota)
          .sort((x, y) => (x.rank ?? Infinity) - (y.rank ?? Infinity)),
        nocCounts: nocCounts.sort((x, y) => y.count - x.count || x.noc.localeCompare(y.noc)),
      };
    }),
    available: allDisciplines.filter((d) => !allocated.has(d.id) && !NON_OLYMPIC.test(d.code)),
  };
  return NextResponse.json(data);
}

/**
 * Uključuje/isključuje kvotu na rezultatu ({ resultId, quota }). Pravila: disciplina ima alokaciju i slobodno mesto,
 * strelac ima najviše jednu kvotu, država najviše jednu po takmičenju i disciplini i najviše MAX_QUOTAS_PER_NOC po disciplini.
 */
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
    .select({ disciplineId: results.disciplineId, shooterId: results.shooterId, noc: shooters.nationality })
    .from(results)
    .innerJoin(shooters, eq(shooters.id, results.shooterId))
    .where(and(eq(results.id, resultId), eq(results.competitionId, compId)));
  if (!row) return NextResponse.json({ error: "Rezultat ne pripada ovom takmičenju" }, { status: 404 });

  if (!body.quota) {
    await db.delete(olympicQuotas).where(and(eq(olympicQuotas.resultId, resultId), eq(olympicQuotas.games, GAMES)));
    return NextResponse.json({ ok: true });
  }

  const allocation = await getAllocation(compId, row.disciplineId);
  if (!allocation) return NextResponse.json({ error: "Ova disciplina nema alokaciju kvota na ovom takmičenju" }, { status: 409 });

  const h = holdingsFor(await allHoldings(), compId, row.disciplineId);
  const conflict =
    h.used >= allocation.places ? `Sva mesta (${allocation.places}) su već dodeljena`
    : h.shooterIds.has(row.shooterId) ? "Strelac već ima olimpijsku kvotu"
    : row.noc && h.eventNocs.has(row.noc) ? `${row.noc} već ima kvotu u ovoj disciplini na ovom takmičenju`
    : row.noc && (h.nocCounts.get(row.noc) ?? 0) >= MAX_QUOTAS_PER_NOC ? `${row.noc} već ima ${MAX_QUOTAS_PER_NOC} kvote u ovoj disciplini`
    : null;
  if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

  await db.insert(olympicQuotas).values({ resultId, games: GAMES }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
});

/** Postavlja broj kvota i osnovu deobe discipline na takmičenju ({ disciplineId, places, basis? }); broj ne može ispod već dodeljenih. */
export const PUT = revalidatesPublicSite(async (req: NextRequest, ctx: Ctx) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const compId = await parseId(ctx);
  const body = (await req.json().catch(() => null)) as { disciplineId?: unknown; places?: unknown; basis?: unknown } | null;
  const disciplineId = Number(body?.disciplineId);
  const places = Number(body?.places);
  if (compId == null || !Number.isInteger(disciplineId) || !Number.isInteger(places) || places < 1 || places > 20 || (body?.basis != null && !isBasis(body.basis))) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const [discipline] = await db.select({ code: disciplines.code }).from(disciplines).where(eq(disciplines.id, disciplineId));
  if (!discipline || NON_OLYMPIC.test(discipline.code)) return NextResponse.json({ error: "Disciplina ne deli olimpijske kvote" }, { status: 400 });

  const { used } = holdingsFor(await allHoldings(), compId, disciplineId);
  if (places < used) return NextResponse.json({ error: `Već je dodeljeno ${used} kvota` }, { status: 409 });

  const basis = isBasis(body?.basis) ? body.basis : undefined;
  await db
    .insert(olympicQuotaAllocations)
    .values({ competitionId: compId, disciplineId, games: GAMES, places, ...(basis && { basis }) })
    .onConflictDoUpdate({
      target: [olympicQuotaAllocations.competitionId, olympicQuotaAllocations.disciplineId, olympicQuotaAllocations.games],
      set: { places, ...(basis && { basis }) },
    });
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

  if (holdingsFor(await allHoldings(), compId, disciplineId).used > 0) return NextResponse.json({ error: "Prvo ukloni dodeljene kvote" }, { status: 409 });

  await db
    .delete(olympicQuotaAllocations)
    .where(and(eq(olympicQuotaAllocations.competitionId, compId), eq(olympicQuotaAllocations.disciplineId, disciplineId), eq(olympicQuotaAllocations.games, GAMES)));
  return NextResponse.json({ ok: true });
});

/**
 * Automatska dodela: za svaku disciplinu sa alokacijom popunjava slobodna mesta po plasmanu na kom se kvote dele
 * (finale ili kvalifikacije), po pravilima iz assignQuotas. Poziva se kad je rangiranje gotovo; dodeljeno se ručno može menjati.
 */
export const PATCH = revalidatesPublicSite(async (_req: NextRequest, ctx: Ctx) => {
  const denied = await requireAdmin();
  if (denied) return denied;
  const compId = await parseId(ctx);
  if (compId == null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const allocations = await db
    .select({ disciplineId: olympicQuotaAllocations.disciplineId, places: olympicQuotaAllocations.places, basis: olympicQuotaAllocations.basis })
    .from(olympicQuotaAllocations)
    .innerJoin(disciplines, eq(disciplines.id, olympicQuotaAllocations.disciplineId))
    .where(and(eq(olympicQuotaAllocations.competitionId, compId), eq(olympicQuotaAllocations.games, GAMES)))
    .orderBy(asc(disciplines.code));

  let assigned = 0;
  for (const a of allocations) {
    // Stanje se čita ponovo po disciplini: strelac koji je upravo dobio kvotu ne sme dobiti drugu.
    const h = holdingsFor(await allHoldings(), compId, a.disciplineId);
    const rank = rankColumn(a.basis as QuotaBasis);
    const rows = await db
      .select({ resultId: results.id, shooterId: results.shooterId, nationality: shooters.nationality, rank })
      .from(results)
      .innerJoin(shooters, eq(shooters.id, results.shooterId))
      .where(and(eq(results.competitionId, compId), eq(results.disciplineId, a.disciplineId), eq(results.category, "senior"), isNotNull(rank)));

    const won = assignQuotas({
      places: a.places - h.used,
      candidates: rows.map((r) => ({ ...r, rank: r.rank! })),
      shooterIds: h.shooterIds,
      eventNocs: h.eventNocs,
      nocCounts: h.nocCounts,
    });
    if (won.length) {
      await db.insert(olympicQuotas).values(won.map((w) => ({ resultId: w.resultId, games: GAMES }))).onConflictDoNothing();
      assigned += won.length;
    }
  }
  return NextResponse.json({ assigned });
});
