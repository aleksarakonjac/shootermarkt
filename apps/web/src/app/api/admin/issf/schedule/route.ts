import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@shootermarkt/db";
import { competitions, competitionSchedule, disciplines, disciplineCodeEnum } from "@shootermarkt/db/schema";
import { eq, inArray } from "drizzle-orm";

type DisciplineCode = typeof disciplineCodeEnum.enumValues[number];
import { fetchScheduleFromHtml, type ISSFScheduleEntry } from "@shootermarkt/adapters/issf/adapter";
import { venueLocalToUtc } from "@/lib/timezone";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

// GET /api/admin/issf/schedule?issfId=3574&year=2026
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const issfId = parseInt(req.nextUrl.searchParams.get("issfId") ?? "");
  const year   = parseInt(req.nextUrl.searchParams.get("year") ?? "") || new Date().getFullYear();

  if (!issfId) return NextResponse.json({ error: "issfId required" }, { status: 400 });

  const entries = await fetchScheduleFromHtml(issfId, year);
  return NextResponse.json(entries);
}

// POST /api/admin/issf/schedule
// Body: { dbCompetitionId: number, entries: ISSFScheduleEntry[] }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { dbCompetitionId: number; entries: ISSFScheduleEntry[] };
  const { dbCompetitionId, entries } = body;

  if (!dbCompetitionId || !entries?.length) {
    return NextResponse.json({ error: "dbCompetitionId and entries required" }, { status: 400 });
  }

  // Get competition timezone for correct UTC conversion
  const comp = await db.select({ timezone: competitions.timezone })
    .from(competitions)
    .where(eq(competitions.id, dbCompetitionId))
    .then((r) => r[0]);
  const timezone = comp?.timezone ?? "UTC";

  // Resolve discipline codes to IDs
  const codes = [...new Set(entries.map((e) => e.disciplineCode).filter(Boolean))] as DisciplineCode[];
  const discRows = await db.select({ id: disciplines.id, code: disciplines.code })
    .from(disciplines)
    .where(inArray(disciplines.code, codes));
  const codeToId = Object.fromEntries(discRows.map((d) => [d.code, d.id]));

  const toInsert = entries
    .filter((e) => e.disciplineCode && codeToId[e.disciplineCode] && e.startTime)
    .map((e) => ({
      competitionId: dbCompetitionId,
      disciplineId: codeToId[e.disciplineCode!],
      stage: e.stage === "training" || e.stage === "ceremony" || e.stage === "other" ? "qual" : e.stage,
      category: "senior" as const,
      startTime: venueLocalToUtc(e.date, e.startTime, timezone),
      endTime: e.endTime ? venueLocalToUtc(e.date, e.endTime, timezone) : null,
    }));

  if (!toInsert.length) {
    return NextResponse.json({ error: "No valid entries to import" }, { status: 400 });
  }

  const inserted = await db.insert(competitionSchedule)
    .values(toInsert)
    .onConflictDoNothing()
    .returning({ id: competitionSchedule.id });

  return NextResponse.json({ imported: inserted.length, skipped: toInsert.length - inserted.length });
}
