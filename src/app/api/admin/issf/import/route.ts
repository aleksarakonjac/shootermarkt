import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchCompetitionResults,
  extractMvpEvents,
  extractMixedTeamEvents,
  fetchQualResultsFromHtml,
  fetchFinalResultsFromHtml,
  fetchR3PResultsFromHtml,
  fetchMixedTeamQualFromHtml,
  fetchMixedTeamFinalFromHtml,
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
  const disciplineCodes: string[] | undefined = body.disciplineCodes;
  const codeFilter = disciplineCodes?.length ? new Set(disciplineCodes) : null;

  const groups = await fetchCompetitionResults(competitionId);
  let mvpEvents = extractMvpEvents(groups);
  let mixedEvents = extractMixedTeamEvents(groups);
  if (codeFilter) {
    mvpEvents = mvpEvents.filter((e) => codeFilter.has(e.disciplineCode));
    mixedEvents = mixedEvents.filter((e) => codeFilter.has(e.disciplineCode));
  }

  if (mvpEvents.length === 0 && mixedEvents.length === 0) {
    return NextResponse.json(
      { error: "No supported events found in this competition" },
      { status: 404 }
    );
  }

  const allShooters = await db
    .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality })
    .from(shooters);

  const rows: ReviewRow[] = [];

  for (const { disciplineCode, category, qualPhase, finalPhase, elimPhases } of mvpEvents) {
    const isR3P = disciplineCode === "R3PM" || disciplineCode === "R3PW";

    // ── 3-Position Rifle: qual published as elimination relay groups ──────────
    if (isR3P) {
      const relayPhases = elimPhases.filter((ep) => ep.phase.resultKey);
      if (relayPhases.length === 0) continue;

      const allR3P: Awaited<ReturnType<typeof fetchR3PResultsFromHtml>> = [];
      for (const { phase } of relayPhases) {
        try {
          const relay = await fetchR3PResultsFromHtml(competitionId, phase.resultKey!);
          allR3P.push(...relay);
        } catch { continue; }
      }
      if (allR3P.length === 0) continue;

      // Sort by total DESC (inners tiebreak), assign combined qual ranks
      allR3P.sort((a, b) => b.total - a.total || (b.inners ?? 0) - (a.inners ?? 0));
      allR3P.forEach((r, idx) => { r.rank = idx + 1; });

      for (const result of allR3P) {
        const match = matchShooter(result.firstName, result.lastName, result.nationCode, allShooters);
        const shooterId = match.kind === "exact" ? match.id : undefined;
        rows.push({
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
          qualPositions: {
            kneeling: result.kneeling,
            prone:    result.prone,
            standing: result.standing,
          },
          qualified: result.qualified,
          remark: result.remark,
          finalTotal: null,
          finalRank: null,
          warning: shooterId ? undefined : "Novi strelac — biće kreiran",
        });
      }
      continue;
    }

    // ── Standard individual events (ARM / ARW / APM / APW) ───────────────────
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
        remark: result.remark,
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

  // ── Mixed team ───────────────────────────────────────────────────────────────
  type MixedEntry = {
    skip: boolean; nocCode: string; disciplineCode: string;
    qualRank: number | null; qualTotal: number | null; inners: number | null;
    qualified: boolean; finalRank: number | null; finalTotal: number | null;
    mIssfId: string | null; mLastName: string; mFirstName: string; m_series: number[]; mTotal: number;
    fIssfId: string | null; fLastName: string; fFirstName: string; f_series: number[]; fTotal: number;
  };

  const mixedEntries: MixedEntry[] = [];
  const mixedErrors: string[] = [];

  for (const { disciplineCode, qualPhase, finalPhase } of mixedEvents) {
    const byNoc = new Map<string, MixedEntry>();

    if (qualPhase?.resultKey) {
      try {
        const qualRows = await fetchMixedTeamQualFromHtml(competitionId, qualPhase.resultKey);
        for (const r of qualRows) {
          byNoc.set(r.nocCode, {
            skip: false, nocCode: r.nocCode, disciplineCode,
            qualRank: r.rank, qualTotal: r.total, inners: r.inners, qualified: r.qualified,
            finalRank: null, finalTotal: null,
            mIssfId: r.mIssfId, mLastName: r.mLastName, mFirstName: r.mFirstName, m_series: r.mSeries, mTotal: r.mTotal,
            fIssfId: r.fIssfId, fLastName: r.fLastName, fFirstName: r.fFirstName, f_series: r.fSeries, fTotal: r.fTotal,
          });
        }
      } catch (e) { mixedErrors.push(`${disciplineCode} qual: ${e}`); }
    }

    if (finalPhase?.resultKey) {
      try {
        const finalRows = await fetchMixedTeamFinalFromHtml(competitionId, finalPhase.resultKey);
        for (const r of finalRows) {
          const ex = byNoc.get(r.nocCode);
          if (ex) {
            ex.finalRank = r.rank; ex.finalTotal = r.total;
            if (r.mIssfId && !ex.mIssfId) ex.mIssfId = r.mIssfId;
            if (r.mLastName && !ex.mLastName) { ex.mLastName = r.mLastName; ex.mFirstName = r.mFirstName; }
            if (r.fIssfId && !ex.fIssfId) ex.fIssfId = r.fIssfId;
            if (r.fLastName && !ex.fLastName) { ex.fLastName = r.fLastName; ex.fFirstName = r.fFirstName; }
          } else {
            byNoc.set(r.nocCode, {
              skip: false, nocCode: r.nocCode, disciplineCode,
              qualRank: null, qualTotal: null, inners: null, qualified: true,
              finalRank: r.rank, finalTotal: r.total,
              mIssfId: r.mIssfId, mLastName: r.mLastName, mFirstName: r.mFirstName, m_series: [], mTotal: 0,
              fIssfId: r.fIssfId, fLastName: r.fLastName, fFirstName: r.fFirstName, f_series: [], fTotal: 0,
            });
          }
        }
      } catch (e) { mixedErrors.push(`${disciplineCode} final: ${e}`); }
    }

    mixedEntries.push(...byNoc.values());
  }

  return NextResponse.json({
    rows,
    mixedEntries,
    eventCount: mvpEvents.length + mixedEvents.length,
    mixedErrors,
  });
}
