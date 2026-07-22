import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchCompetitionResults,
  extractMixedTeamEvents,
  fetchMixedTeamQualFromHtml,
  fetchMixedTeamFinalFromHtml,
} from "@/lib/issf/adapter";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const competitionId = parseInt(body.competitionId);
  if (isNaN(competitionId)) {
    return NextResponse.json({ error: "competitionId required" }, { status: 400 });
  }

  const groups = await fetchCompetitionResults(competitionId);
  const mixedEvents = extractMixedTeamEvents(groups);

  if (mixedEvents.length === 0) {
    return NextResponse.json({ error: "No mixed team events found in this competition" }, { status: 404 });
  }

  type MixedEntry = {
    skip: boolean;
    nocCode: string;
    disciplineCode: string;
    qualRank: number | null;
    qualTotal: number | null;
    inners: number | null;
    qualified: boolean;
    finalRank: number | null;
    finalTotal: number | null;
    mIssfId: string | null;
    mLastName: string;
    mFirstName: string;
    m_series: number[];
    mTotal: number;
    fIssfId: string | null;
    fLastName: string;
    fFirstName: string;
    f_series: number[];
    fTotal: number;
  };

  const allEntries: MixedEntry[] = [];
  const errors: string[] = [];

  for (const { disciplineCode, qualPhase, finalPhase } of mixedEvents) {
    const byNoc = new Map<string, MixedEntry>();

    // Qual
    if (qualPhase?.resultKey) {
      try {
        const qualRows = await fetchMixedTeamQualFromHtml(competitionId, qualPhase.resultKey);
        for (const r of qualRows) {
          byNoc.set(r.nocCode, {
            skip: false,
            nocCode: r.nocCode,
            disciplineCode,
            qualRank: r.rank,
            qualTotal: r.total,
            inners: r.inners,
            qualified: r.qualified,
            finalRank: null,
            finalTotal: null,
            mIssfId: r.mIssfId,
            mLastName: r.mLastName,
            mFirstName: r.mFirstName,
            m_series: r.mSeries,
            mTotal: r.mTotal,
            fIssfId: r.fIssfId,
            fLastName: r.fLastName,
            fFirstName: r.fFirstName,
            f_series: r.fSeries,
            fTotal: r.fTotal,
          });
        }
      } catch (e) {
        errors.push(`${disciplineCode} qual: ${e}`);
      }
    }

    // Final — merge into existing qual entries (or create new if no qual)
    if (finalPhase?.resultKey) {
      try {
        const finalRows = await fetchMixedTeamFinalFromHtml(competitionId, finalPhase.resultKey);
        for (const r of finalRows) {
          const existing = byNoc.get(r.nocCode);
          if (existing) {
            existing.finalRank  = r.rank;
            existing.finalTotal = r.total;
            if (r.mIssfId && !existing.mIssfId) existing.mIssfId = r.mIssfId;
            if (r.mLastName && !existing.mLastName) { existing.mLastName = r.mLastName; existing.mFirstName = r.mFirstName; }
            if (r.fIssfId && !existing.fIssfId) existing.fIssfId = r.fIssfId;
            if (r.fLastName && !existing.fLastName) { existing.fLastName = r.fLastName; existing.fFirstName = r.fFirstName; }
          } else {
            byNoc.set(r.nocCode, {
              skip: false,
              nocCode: r.nocCode,
              disciplineCode,
              qualRank: null,
              qualTotal: null,
              inners: null,
              qualified: true,
              finalRank: r.rank,
              finalTotal: r.total,
              mIssfId: r.mIssfId,
              mLastName: r.mLastName,
              mFirstName: r.mFirstName,
              m_series: [],
              mTotal: 0,
              fIssfId: r.fIssfId,
              fLastName: r.fLastName,
              fFirstName: r.fFirstName,
              f_series: [],
              fTotal: 0,
            });
          }
        }
      } catch (e) {
        errors.push(`${disciplineCode} final: ${e}`);
      }
    }

    allEntries.push(...byNoc.values());
  }

  return NextResponse.json({ entries: allEntries, eventCount: mixedEvents.length, errors });
}
