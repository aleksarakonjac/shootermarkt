import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@shootermarkt/db";
import { competitionSchedule, competitions } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { competitionId, disciplineId, stage, category, startTime, endTime } = body;

  if (!competitionId || !disciplineId || !stage || !startTime) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate stage start_time is within competition date range
  const [comp] = await db.select({ date: competitions.date, dateEnd: competitions.dateEnd, timezone: competitions.timezone })
    .from(competitions)
    .where(eq(competitions.id, competitionId));

  if (!comp) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

  // startTime is a UTC instant; derive the venue-local calendar date for range validation.
  const slotDate = new Intl.DateTimeFormat("en-CA", { timeZone: comp.timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(startTime)); // YYYY-MM-DD
  const compStart = comp.date;
  const compEnd = comp.dateEnd ?? comp.date;

  if (slotDate < compStart || slotDate > compEnd) {
    return NextResponse.json(
      { error: `Datum slota (${slotDate}) mora biti unutar opsega takmičenja (${compStart}–${compEnd})` },
      { status: 400 }
    );
  }

  const [slot] = await db.insert(competitionSchedule).values({
    competitionId,
    disciplineId,
    stage,
    category: category || "senior",
    startTime: new Date(startTime),
    endTime: endTime ? new Date(endTime) : null,
  }).returning();

  revalidatePath("/", "layout");
  return NextResponse.json(slot, { status: 201 });
}
