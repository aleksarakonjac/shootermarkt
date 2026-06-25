import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePdfWithGemini } from "@/lib/pdf-import/gemini-adapter";
import { db } from "@/lib/db";
import { shooters, clubs } from "@/lib/db/schema";
import { eq, ilike, and } from "drizzle-orm";
import type { ReviewRow } from "@/lib/pdf-import/types";

function isAdmin(email: string | undefined): boolean {
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

  // Enrich parsed results with DB matches for shooter/club
  const allClubs = await db.select().from(clubs);
  const allShooters = await db.select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, clubId: shooters.clubId }).from(shooters);

  const rows: ReviewRow[] = [];

  for (const event of bilten.events) {
    if (event.stage !== "qualification") continue;

    for (const r of event.results as Array<{
      rank: number; lastName: string; firstName: string;
      clubNoc?: string; series: number[]; total: number;
      inners?: number | null; qualified?: boolean | null;
    }>) {
      // Try to match shooter by name (case-insensitive)
      const matchedShooter = allShooters.find(
        (s) =>
          s.lastName.toLowerCase() === r.lastName.toLowerCase() &&
          s.firstName.toLowerCase() === r.firstName.toLowerCase()
      );

      // Try to match club by NOC code
      const matchedClub = r.clubNoc
        ? allClubs.find((c) => c.nocCode === r.clubNoc)
        : undefined;

      const row: ReviewRow = {
        shooterId: matchedShooter?.id,
        firstName: r.firstName,
        lastName: r.lastName,
        clubNoc: r.clubNoc,
        clubId: matchedClub?.id ?? matchedShooter?.clubId ?? undefined,
        disciplineCode: event.discipline,
        qualTotal: r.total,
        qualInners: r.inners ?? null,
        qualRank: r.rank,
        qualSeries: r.series,
        qualified: r.qualified ?? null,
      };

      if (!matchedShooter) {
        row.warning = "Strelac nije pronađen u bazi — biće kreiran novi";
      }

      rows.push(row);
    }
  }

  return NextResponse.json({ rows, eventsCount: bilten.events.length });
}

export const config = {
  api: { bodyParser: false },
};
