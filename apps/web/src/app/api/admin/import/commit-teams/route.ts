import { NextRequest, NextResponse } from "next/server";
import type { TeamResultEntry } from "@shootermarkt/db/pdf-import-types";
import { commitTeamResults } from "@/lib/import-commit-teams";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

async function handlePOST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { competitionId?: number; entries?: TeamResultEntry[] } | null;
  if (!Number.isInteger(body?.competitionId) || !Array.isArray(body?.entries) || !body.entries.every((e) => e && Array.isArray(e.members))) {
    return NextResponse.json({ error: "competitionId and entries required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await commitTeamResults(body.competitionId!, body.entries));
  } catch (error) {
    console.error("Team results import commit failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Team commit failed" }, { status: 500 });
  }
}

export const POST = revalidatesPublicSite(handlePOST);
