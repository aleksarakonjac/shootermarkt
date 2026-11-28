import { NextRequest, NextResponse } from "next/server";
import type { MixedTeamEntry, ReviewRow, TeamResultEntry } from "@shootermarkt/db/pdf-import-types";
import { eq } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitionEvents } from "@shootermarkt/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { matchDateConflicts } from "@/lib/import-diff";
import { diffSiusImport } from "@/lib/sius-bulk";

/** Read-only: what committing these rows would add or overwrite in the competition. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { competitionId, rows, teams = [], teamResults = [] } = (await req.json()) as { competitionId: number; rows: ReviewRow[]; teams?: MixedTeamEntry[]; teamResults?: TeamResultEntry[] };
  if (!Number.isInteger(competitionId) || !Array.isArray(rows) || !Array.isArray(teams) || !Array.isArray(teamResults)) {
    return NextResponse.json({ error: "competitionId and rows required" }, { status: 400 });
  }
  const [diff, events] = await Promise.all([
    diffSiusImport(competitionId, rows, teams, teamResults),
    db.select({ name: competitionEvents.name, date: competitionEvents.date }).from(competitionEvents).where(eq(competitionEvents.competitionId, competitionId)),
  ]);
  return NextResponse.json({ ...diff, dateConflicts: matchDateConflicts(events, [...rows, ...teams, ...teamResults]) });
}
