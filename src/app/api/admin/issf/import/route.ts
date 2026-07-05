import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchCompetitionResults,
  extractMvpEvents,
  fetchQualResultsFromHtml,
} from "@/lib/issf/adapter";
import { db } from "@/lib/db";
import { shooters, clubs } from "@/lib/db/schema";
import type { ReviewRow } from "@/lib/pdf-import/types";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const competitionId = parseInt(body.competitionId);
  if (isNaN(competitionId)) {
    return NextResponse.json({ error: "competitionId required" }, { status: 400 });
  }

  const groups = await fetchCompetitionResults(competitionId);
  const mvpEvents = extractMvpEvents(groups);

  if (mvpEvents.length === 0) {
    return NextResponse.json(
      { error: "No ARM/ARW/APM/APW events found in this competition" },
      { status: 404 }
    );
  }

  const [allClubs, allShooters] = await Promise.all([
    db.select().from(clubs),
    db
      .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality })
      .from(shooters),
  ]);

  const rows: ReviewRow[] = [];

  for (const { disciplineCode, qualPhase } of mvpEvents) {
    if (!qualPhase?.resultKey) continue;

    let qualResults;
    try {
      qualResults = await fetchQualResultsFromHtml(competitionId, qualPhase.resultKey);
    } catch {
      continue;
    }

    for (const result of qualResults) {
      const matchedShooter = allShooters.find(
        (s) =>
          s.lastName.toLowerCase() === result.lastName.toLowerCase() &&
          s.firstName.toLowerCase() === result.firstName.toLowerCase() &&
          (!s.nationality || s.nationality === result.nationCode)
      );

      rows.push({
        shooterId: matchedShooter?.id,
        firstName: result.firstName,
        lastName: result.lastName,
        teamNoc: result.nationCode,
        disciplineCode,
        qualTotal: result.total,
        qualInners: result.inners,
        qualRank: result.rank,
        qualSeries: result.series,
        qualified: result.qualified,
        finalTotal: null,
        finalRank: null,
        warning: matchedShooter ? undefined : "Novi strelac — biće kreiran",
      });
    }
  }

  return NextResponse.json({ rows, eventCount: mvpEvents.length });
}
