import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { competitionScheduleChanges } from "@shootermarkt/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

// POST { ids?: number[], competitionId?: number } — marks changes as seen.
async function handlePOST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { ids, competitionId } = await req.json() as { ids?: number[]; competitionId?: number };
  const where = ids?.length ? inArray(competitionScheduleChanges.id, ids)
    : competitionId ? eq(competitionScheduleChanges.competitionId, competitionId) : null;
  if (!where) return NextResponse.json({ error: "ids or competitionId required" }, { status: 400 });
  await db.update(competitionScheduleChanges).set({ acknowledgedAt: new Date() })
    .where(and(where, isNull(competitionScheduleChanges.acknowledgedAt)));
  return NextResponse.json({ ok: true });
}

export const POST = revalidatesPublicSite(handlePOST);
