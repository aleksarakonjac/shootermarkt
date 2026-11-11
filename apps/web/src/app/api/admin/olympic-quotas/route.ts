import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { disciplines, olympicQuotaAllocations, olympicQuotas, shooters } from "@shootermarkt/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatesPublicSite } from "@/lib/revalidate-public";
import { GAMES, NON_OLYMPIC, allHoldings } from "@/lib/quota-holdings";

/** Izvori kvota koji nisu takmičenje: dodeljuju se ručno kad se saznaju. */
const MANUAL_KINDS = ["ranking", "host", "universality"] as const;
type ManualKind = (typeof MANUAL_KINDS)[number];
const isKind = (v: unknown): v is ManualKind => MANUAL_KINDS.includes(v as ManualKind);

export type ManualAllocation = {
  id: number;
  kind: ManualKind;
  disciplineId: number;
  code: string;
  name: string;
  places: number;
  holders: Array<{ quotaId: number; shooterId: number; firstName: string; lastName: string; nationality: string | null }>;
};

export type ManualQuotaData = { allocations: ManualAllocation[]; disciplines: Array<{ id: number; code: string; name: string }> };

/** Alokacije rang-liste, domaćina i univerzalnih mesta sa dodeljenim strelcima, i discipline koje dele kvote. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [allocations, awards, allDisciplines] = await Promise.all([
    db
      .select({
        id: olympicQuotaAllocations.id,
        kind: olympicQuotaAllocations.kind,
        disciplineId: olympicQuotaAllocations.disciplineId,
        places: olympicQuotaAllocations.places,
        code: disciplines.code,
        name: disciplines.name,
      })
      .from(olympicQuotaAllocations)
      .innerJoin(disciplines, eq(disciplines.id, olympicQuotaAllocations.disciplineId))
      .where(and(isNull(olympicQuotaAllocations.competitionId), eq(olympicQuotaAllocations.games, GAMES)))
      .orderBy(asc(olympicQuotaAllocations.kind), asc(disciplines.code)),
    db
      .select({ quotaId: olympicQuotas.id, allocationId: olympicQuotas.allocationId, shooterId: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality })
      .from(olympicQuotas)
      .innerJoin(shooters, eq(shooters.id, olympicQuotas.shooterId))
      .where(eq(olympicQuotas.games, GAMES)),
    db.select({ id: disciplines.id, code: disciplines.code, name: disciplines.name }).from(disciplines).orderBy(asc(disciplines.code)),
  ]);

  const data: ManualQuotaData = {
    allocations: allocations.map((a) => ({
      ...a,
      kind: a.kind as ManualKind,
      holders: awards.filter((w) => w.allocationId === a.id).map(({ allocationId: _a, ...h }) => h),
    })),
    disciplines: allDisciplines.filter((d) => !NON_OLYMPIC.test(d.code)),
  };
  return NextResponse.json(data);
}

async function findAllocation(kind: ManualKind, disciplineId: number) {
  const [row] = await db
    .select({ id: olympicQuotaAllocations.id, places: olympicQuotaAllocations.places })
    .from(olympicQuotaAllocations)
    .where(and(isNull(olympicQuotaAllocations.competitionId), eq(olympicQuotaAllocations.kind, kind), eq(olympicQuotaAllocations.disciplineId, disciplineId), eq(olympicQuotaAllocations.games, GAMES)));
  return row ?? null;
}

async function awardedCount(allocationId: number) {
  const rows = await db.select({ id: olympicQuotas.id }).from(olympicQuotas).where(eq(olympicQuotas.allocationId, allocationId));
  return rows.length;
}

/** Postavlja broj mesta izvora u disciplini ({ kind, disciplineId, places }). Broj ne može ispod već dodeljenih. */
export const PUT = revalidatesPublicSite(async (req: NextRequest) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { kind?: unknown; disciplineId?: unknown; places?: unknown } | null;
  const disciplineId = Number(body?.disciplineId);
  const places = Number(body?.places);
  if (!isKind(body?.kind) || !Number.isInteger(disciplineId) || !Number.isInteger(places) || places < 1 || places > 50) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const [discipline] = await db.select({ code: disciplines.code }).from(disciplines).where(eq(disciplines.id, disciplineId));
  if (!discipline || NON_OLYMPIC.test(discipline.code)) return NextResponse.json({ error: "Disciplina ne deli olimpijske kvote" }, { status: 400 });

  const existing = await findAllocation(body.kind, disciplineId);
  if (existing) {
    const used = await awardedCount(existing.id);
    if (places < used) return NextResponse.json({ error: `Već je dodeljeno ${used} kvota` }, { status: 409 });
    await db.update(olympicQuotaAllocations).set({ places }).where(eq(olympicQuotaAllocations.id, existing.id));
  } else {
    await db.insert(olympicQuotaAllocations).values({ competitionId: null, kind: body.kind, disciplineId, games: GAMES, places });
  }
  return NextResponse.json({ ok: true });
});

/** Uklanja izvor ({ kind, disciplineId }); samo ako nijedna kvota nije dodeljena. */
export const DELETE = revalidatesPublicSite(async (req: NextRequest) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { kind?: unknown; disciplineId?: unknown } | null;
  const disciplineId = Number(body?.disciplineId);
  if (!isKind(body?.kind) || !Number.isInteger(disciplineId)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await findAllocation(body.kind, disciplineId);
  if (!existing) return NextResponse.json({ ok: true });
  if ((await awardedCount(existing.id)) > 0) return NextResponse.json({ error: "Prvo ukloni dodeljene strelce" }, { status: 409 });
  await db.delete(olympicQuotaAllocations).where(eq(olympicQuotaAllocations.id, existing.id));
  return NextResponse.json({ ok: true });
});

/** Dodeljuje ili oduzima kvotu strelcu ({ allocationId, shooterId, quota }). Strelac može imati najviše jednu olimpijsku kvotu. */
export const POST = revalidatesPublicSite(async (req: NextRequest) => {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { allocationId?: unknown; shooterId?: unknown; quota?: unknown } | null;
  const allocationId = Number(body?.allocationId);
  const shooterId = Number(body?.shooterId);
  if (!Number.isInteger(allocationId) || !Number.isInteger(shooterId) || typeof body?.quota !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const [allocation] = await db
    .select({ places: olympicQuotaAllocations.places })
    .from(olympicQuotaAllocations)
    .where(and(eq(olympicQuotaAllocations.id, allocationId), isNull(olympicQuotaAllocations.competitionId)));
  if (!allocation) return NextResponse.json({ error: "Izvor kvota ne postoji" }, { status: 404 });

  if (!body.quota) {
    await db.delete(olympicQuotas).where(and(eq(olympicQuotas.allocationId, allocationId), eq(olympicQuotas.shooterId, shooterId)));
    return NextResponse.json({ ok: true });
  }

  const [shooter] = await db.select({ id: shooters.id }).from(shooters).where(eq(shooters.id, shooterId));
  if (!shooter) return NextResponse.json({ error: "Strelac ne postoji" }, { status: 404 });
  if ((await awardedCount(allocationId)) >= allocation.places) return NextResponse.json({ error: `Sva mesta (${allocation.places}) su već dodeljena` }, { status: 409 });
  if ((await allHoldings()).some((h) => h.shooterId === shooterId)) return NextResponse.json({ error: "Strelac već ima olimpijsku kvotu" }, { status: 409 });

  await db.insert(olympicQuotas).values({ allocationId, shooterId, games: GAMES });
  return NextResponse.json({ ok: true });
});
