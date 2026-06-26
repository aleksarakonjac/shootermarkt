import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchCompetitionResults,
  extractMvpEvents,
  ISSFResultPhase,
} from "@/lib/issf/adapter";
import { parsePdfWithGemini } from "@/lib/pdf-import/gemini-adapter";
import { db } from "@/lib/db";
import { shooters, clubs } from "@/lib/db/schema";
import type { ReviewRow } from "@/lib/pdf-import/types";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

async function fetchPdfBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDF fetch failed: ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
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
      .select({
        id: shooters.id,
        firstName: shooters.firstName,
        lastName: shooters.lastName,
        nationality: shooters.nationality,
        clubId: shooters.clubId,
      })
      .from(shooters),
  ]);

  const rows: ReviewRow[] = [];

  for (const { disciplineCode, qualPhase, finalPhase } of mvpEvents) {
    if (!qualPhase?.pdfResultLink) continue;

    const pdfBuffer = await fetchPdfBuffer(qualPhase.pdfResultLink);
    const bilten = await parsePdfWithGemini(pdfBuffer);

    // Find matching event in parsed bilten
    const event = bilten.events.find(
      (e) => e.discipline === disciplineCode && e.stage === "qualification"
    );
    if (!event) continue;

    let finalPhaseResults: Map<string, number> | null = null;
    if (finalPhase?.pdfResultLink) {
      try {
        const finalBuffer = await fetchPdfBuffer(finalPhase.pdfResultLink);
        const finalBilten = await parsePdfWithGemini(finalBuffer);
        const finalEvent = finalBilten.events.find(
          (e) => e.discipline === disciplineCode && e.stage === "final"
        );
        if (finalEvent) {
          finalPhaseResults = new Map(
            finalEvent.results.map((r) => [
              `${r.lastName.toLowerCase()}_${r.firstName.toLowerCase()}`,
              (r as { total: number }).total,
            ])
          );
        }
      } catch {
        // Final PDF parsing is best-effort
      }
    }

    for (const result of event.results as Array<{
      rank: number;
      lastName: string;
      firstName: string;
      teamNoc: string;
      clubName?: string;
      series: number[];
      total: number;
      inners?: number | null;
      qualified?: boolean | null;
    }>) {
      const key = `${result.lastName.toLowerCase()}_${result.firstName.toLowerCase()}`;
      const finalTotal = finalPhaseResults?.get(key) ?? null;

      const matchedShooter = allShooters.find(
        (s) =>
          s.lastName.toLowerCase() === result.lastName.toLowerCase() &&
          s.firstName.toLowerCase() === result.firstName.toLowerCase() &&
          (!s.nationality || s.nationality === result.teamNoc)
      );

      const matchedClub = result.clubName
        ? allClubs.find(
            (c) =>
              c.nocCode?.toLowerCase() === result.clubName?.toLowerCase() ||
              c.name.toLowerCase().includes(result.clubName!.toLowerCase())
          )
        : undefined;

      const row: ReviewRow = {
        shooterId: matchedShooter?.id,
        firstName: result.firstName,
        lastName: result.lastName,
        teamNoc: result.teamNoc,
        clubAbbr: result.clubName,
        clubId: matchedClub?.id,
        disciplineCode,
        qualTotal: result.total,
        qualInners: result.inners,
        qualRank: result.rank,
        qualSeries: result.series,
        qualified: result.qualified,
        finalTotal,
        finalRank: null,
        warning: matchedShooter ? undefined : "Novi strelac — biće kreiran",
      };

      rows.push(row);
    }
  }

  return NextResponse.json({ rows, eventCount: mvpEvents.length });
}
