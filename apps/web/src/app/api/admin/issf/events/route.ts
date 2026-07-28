import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCompetitionResults, extractMvpEvents, extractMixedTeamEvents } from "@shootermarkt/adapters/issf/adapter";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

const LABEL: Record<string, string> = {
  ARM: "10m Air Rifle Men", ARW: "10m Air Rifle Women",
  APM: "10m Air Pistol Men", APW: "10m Air Pistol Women",
  R3PM: "50m Rifle 3P Men", R3PW: "50m Rifle 3P Women",
  ARMT: "10m Air Rifle Mixed Team", APMT: "10m Air Pistol Mixed Team",
};

// GET /api/admin/issf/events?competitionId=3574
// Lists disciplines available for a competition so the admin can pick which
// ones to actually pull (mixed team events are common standalone picks).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const competitionId = parseInt(req.nextUrl.searchParams.get("competitionId") ?? "");
  if (isNaN(competitionId)) return NextResponse.json({ error: "competitionId required" }, { status: 400 });

  const groups = await fetchCompetitionResults(competitionId);
  const mvpEvents = extractMvpEvents(groups);
  const mixedEvents = extractMixedTeamEvents(groups);

  const seen = new Set<string>();
  const events: Array<{ code: string; label: string }> = [];
  for (const { disciplineCode } of mvpEvents) {
    if (seen.has(disciplineCode)) continue;
    seen.add(disciplineCode);
    events.push({ code: disciplineCode, label: LABEL[disciplineCode] ?? disciplineCode });
  }
  for (const { disciplineCode } of mixedEvents) {
    if (seen.has(disciplineCode)) continue;
    seen.add(disciplineCode);
    events.push({ code: disciplineCode, label: LABEL[disciplineCode] ?? disciplineCode });
  }

  return NextResponse.json(events);
}
