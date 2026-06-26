import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchQualFile, downloadSiusPdf } from "@/lib/sius/adapter";
import { parsePdfWithGemini } from "@/lib/pdf-import/gemini-adapter";
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
  const { guid, events, name } = body as {
    guid: string;
    events: string[]; // e.g. ["ARM", "ARW", "APM", "APW"]
    name: string;
  };

  if (!guid || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: "guid and events required" }, { status: 400 });
  }

  const [allClubs, allShooters] = await Promise.all([
    db.select().from(clubs),
    db
      .select({
        id: shooters.id,
        firstName: shooters.firstName,
        lastName: shooters.lastName,
        nationality: shooters.nationality,
      })
      .from(shooters),
  ]);

  const rows: ReviewRow[] = [];
  let eventCount = 0;
  const errors: string[] = [];

  for (const event of events) {
    const disciplineCode = event as ReviewRow["disciplineCode"];

    let qualFile: string | null;
    try {
      qualFile = await fetchQualFile(guid, event);
    } catch (e) {
      errors.push(`${event}: file list error — ${e}`);
      continue;
    }

    if (!qualFile) {
      errors.push(`${event}: qualification individual ranklist not found`);
      continue;
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await downloadSiusPdf(guid, qualFile);
    } catch (e) {
      errors.push(`${event}: PDF download failed — ${e}`);
      continue;
    }

    let bilten;
    try {
      bilten = await parsePdfWithGemini(pdfBuffer);
    } catch (e) {
      errors.push(`${event}: Gemini parse failed — ${e}`);
      continue;
    }

    const parsedEvent = bilten.events.find(
      (e) => e.discipline === disciplineCode && e.stage === "qualification"
    );
    if (!parsedEvent) {
      errors.push(`${event}: no matching event in parsed PDF`);
      continue;
    }

    eventCount++;

    for (const result of parsedEvent.results as Array<{
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

      rows.push({
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
        finalTotal: null,
        finalRank: null,
        warning: matchedShooter ? undefined : "Novi strelac — biće kreiran",
      });
    }
  }

  if (eventCount === 0) {
    return NextResponse.json(
      { error: "No events parsed successfully", errors },
      { status: 422 }
    );
  }

  return NextResponse.json({ rows, eventCount, errors, name });
}
