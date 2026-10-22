import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { competitions, competitionScheduleChanges } from "@shootermarkt/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { syncCompetitionById } from "@/lib/schedule-sync";

export const maxDuration = 30;

// POST { competitionId, timezone, location? } — sets the venue timezone (and location), then pulls the schedule right away.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { competitionId, timezone, location } = await req.json() as { competitionId: number; timezone: string; location?: string };
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return NextResponse.json({ error: `Nepoznata vremenska zona: ${timezone}` }, { status: 400 });
  }
  const loc = location?.trim();
  await db.update(competitions).set({ timezone, ...(loc ? { location: loc } : {}) }).where(eq(competitions.id, competitionId));
  await db.update(competitionScheduleChanges).set({ acknowledgedAt: new Date() })
    .where(and(eq(competitionScheduleChanges.competitionId, competitionId), eq(competitionScheduleChanges.kind, "tz_missing"), isNull(competitionScheduleChanges.acknowledgedAt)));
  return NextResponse.json({ result: await syncCompetitionById(competitionId) });
}
