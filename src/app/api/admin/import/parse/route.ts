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
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("pdf") as File | null;
  if (!file || file.type !== "application/pdf") {
    return NextResponse.json({ error: "PDF file required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const bilten = await parsePdfWithGemini(buffer);

  const [allClubs, allShooters] = await Promise.all([
    db.select().from(clubs),
    db.select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      nationality: shooters.nationality,
      clubId: shooters.clubId,
    }).from(shooters),
  ]);

  const rows: ReviewRow[] = [];
  const skippedDisciplines = new Set<string>();

  for (const event of bilten.events) {
    if (event.stage !== "qualification") continue;

    for (const r of event.results as Array<{
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
      const nationality = r.teamNoc.toUpperCase();

      // Match shooter by name + nationality (prevents false matches across countries)
      const matchedShooter = allShooters.find(
        (s) =>
          s.lastName.toLowerCase() === r.lastName.toLowerCase() &&
          s.firstName.toLowerCase() === r.firstName.toLowerCase() &&
          (s.nationality === nationality || s.nationality == null)
      );

      // Club matching:
      // - National bilten: match by club name/abbr
      // - International bilten: look up club by country + known club, or leave null
      let matchedClub = matchedShooter?.clubId
        ? allClubs.find((c) => c.id === matchedShooter.clubId)
        : undefined;

      if (!matchedClub && r.clubName) {
        matchedClub = allClubs.find(
          (c) =>
            c.name.toLowerCase() === r.clubName!.toLowerCase() ||
            c.nocCode?.toLowerCase() === r.clubName!.toLowerCase()
        );
      }

      const row: ReviewRow = {
        shooterId: matchedShooter?.id,
        firstName: r.firstName,
        lastName: r.lastName,
        teamNoc: nationality,
        clubAbbr: r.clubName,
        clubId: matchedClub?.id,
        disciplineCode: event.discipline,
        qualTotal: r.total,
        qualInners: r.inners ?? null,
        qualRank: r.rank,
        qualSeries: r.series,
        qualified: r.qualified ?? null,
      };

      if (!matchedShooter) {
        row.warning = event.isInternational
          ? `Novi strelac (${nationality}) — biće kreiran`
          : "Novi strelac — biće kreiran";
      }

      rows.push(row);
    }
  }

  return NextResponse.json({
    rows,
    eventsCount: bilten.events.length,
    skippedDisciplines: Array.from(skippedDisciplines),
  });
}
