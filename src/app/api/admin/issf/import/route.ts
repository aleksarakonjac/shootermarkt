import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchCompetitionResults,
  extractMvpEvents,
  fetchQualResultsFromHtml,
  fetchFinalResultsFromHtml,
} from "@/lib/issf/adapter";
import { deriveFinalRankProgression } from "@/lib/pdf-import/types";
import { db } from "@/lib/db";
import { shooters } from "@/lib/db/schema";
import type { ReviewRow } from "@/lib/pdf-import/types";
import { matchShooter } from "@/lib/name-match";

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

  const allShooters = await db
    .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality })
    .from(shooters);

  const rows: ReviewRow[] = [];

  for (const { disciplineCode, category, qualPhase, finalPhase } of mvpEvents) {
    if (!qualPhase?.resultKey) continue;

    let qualResults;
    try {
      qualResults = await fetchQualResultsFromHtml(competitionId, qualPhase.resultKey);
    } catch {
      continue;
    }

    const discRows: typeof rows = [];

    for (const result of qualResults) {
      const match = matchShooter(result.firstName, result.lastName, result.nationCode, allShooters);
      const shooterId = match.kind === "exact" ? match.id : undefined;

      discRows.push({
        shooterId,
        issfId: result.issfId || undefined,
        firstName: result.firstName,
        lastName: result.lastName,
        teamNoc: result.nationCode,
        disciplineCode,
        category,
        qualTotal: result.total,
        qualInners: result.inners,
        qualRank: result.rank,
        qualSeries: result.series,
        qualified: result.qualified,
        finalTotal: null,
        finalRank: null,
        warning: shooterId ? undefined : "Novi strelac — biće kreiran",
      });
    }

    // Merge final results when available
    if (finalPhase?.resultKey) {
      try {
        const finalResults = await fetchFinalResultsFromHtml(competitionId, finalPhase.resultKey);
        const allCumulatives = finalResults.map((f) => f.stageCumulatives);

        for (const finalist of finalResults) {
          const row = discRows.find(
            (r) =>
              r.lastName.toLowerCase() === finalist.lastName.toLowerCase() &&
              r.firstName.toLowerCase() === finalist.firstName.toLowerCase()
          );
          if (!row) continue;

          row.finalRank = finalist.rank;
          row.finalTotal = finalist.total;
          row.finalCumulative = finalist.stageCumulatives;
          row.finalRanks = deriveFinalRankProgression(finalist.stageCumulatives, allCumulatives);
          row.finalShotsByStage = finalist.shotsByStage;
          row.finalShootOff = finalist.shootOff || null;
          row.finalScoring = disciplineCode.startsWith("AP") ? "hit_count" : "decimal";
          row.qualified = true;
        }
      } catch {
        // Finals may not be published yet — non-fatal
      }
    }

    rows.push(...discRows);
  }

  return NextResponse.json({ rows, eventCount: mvpEvents.length });
}
