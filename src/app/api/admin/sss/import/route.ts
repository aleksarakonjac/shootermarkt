import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
  const { url, filename } = body as { url: string; filename: string };

  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  // Download PDF
  let pdfBuffer: Buffer;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pdfBuffer = Buffer.from(await res.arrayBuffer());
    if (pdfBuffer.byteLength < 100) throw new Error("Empty PDF");
  } catch (e) {
    return NextResponse.json({ error: `PDF download failed: ${e}` }, { status: 502 });
  }

  // Parse with Gemini
  let bilten;
  try {
    bilten = await parsePdfWithGemini(pdfBuffer);
  } catch (e) {
    return NextResponse.json({ error: `Gemini parse failed: ${e}` }, { status: 422 });
  }

  const mvpEvents = bilten.events.filter(
    (e) =>
      ["ARM", "ARW", "APM", "APW"].includes(e.discipline) && e.stage === "qualification"
  );

  if (mvpEvents.length === 0) {
    return NextResponse.json(
      { error: "No ARM/ARW/APM/APW qualification events found in PDF" },
      { status: 422 }
    );
  }

  const [allClubs, allShooters] = await Promise.all([
    db.select().from(clubs),
    db
      .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality })
      .from(shooters),
  ]);

  const rows: ReviewRow[] = [];

  for (const event of mvpEvents) {
    const disciplineCode = event.discipline as ReviewRow["disciplineCode"];

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
      const matchedShooter = allShooters.find(
        (s) =>
          s.lastName.toLowerCase() === result.lastName.toLowerCase() &&
          s.firstName.toLowerCase() === result.firstName.toLowerCase() &&
          (!s.nationality || s.nationality === result.teamNoc || result.teamNoc === "SRB")
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
        teamNoc: result.teamNoc || "SRB",
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

  return NextResponse.json({ rows, eventCount: mvpEvents.length, filename });
}
