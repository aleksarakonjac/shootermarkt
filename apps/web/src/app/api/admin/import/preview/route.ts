import { NextRequest, NextResponse } from "next/server";
import type { MixedTeamEntry, ReviewRow } from "@shootermarkt/db/pdf-import-types";
import { requireAdmin } from "@/lib/admin-auth";
import { diffSiusImport } from "@/lib/sius-bulk";

/** Read-only: what committing these rows would add or overwrite in the competition. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { competitionId, rows, teams = [] } = (await req.json()) as { competitionId: number; rows: ReviewRow[]; teams?: MixedTeamEntry[] };
  if (!Number.isInteger(competitionId) || !Array.isArray(rows) || !Array.isArray(teams)) {
    return NextResponse.json({ error: "competitionId and rows required" }, { status: 400 });
  }
  return NextResponse.json(await diffSiusImport(competitionId, rows, teams));
}
