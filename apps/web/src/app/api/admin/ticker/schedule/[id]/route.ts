import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@shootermarkt/db";
import { competitionSchedule, competitions } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { startTime, endTime } = body;

  if (!startTime) return NextResponse.json({ error: "startTime required" }, { status: 400 });

  // Validate date range
  const [existing] = await db.select().from(competitionSchedule).where(eq(competitionSchedule.id, parseInt(id)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [comp] = await db.select({ date: competitions.date, dateEnd: competitions.dateEnd })
    .from(competitions)
    .where(eq(competitions.id, existing.competitionId));

  const slotDate = startTime.slice(0, 10);
  const compEnd = comp.dateEnd ?? comp.date;
  if (slotDate < comp.date || slotDate > compEnd) {
    return NextResponse.json(
      { error: `Datum slota (${slotDate}) mora biti unutar opsega takmičenja (${comp.date}–${compEnd})` },
      { status: 400 }
    );
  }

  const [updated] = await db.update(competitionSchedule)
    .set({ startTime: new Date(startTime), endTime: endTime ? new Date(endTime) : null })
    .where(eq(competitionSchedule.id, parseInt(id)))
    .returning();

  revalidatePath("/", "layout");
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(competitionSchedule).where(eq(competitionSchedule.id, parseInt(id)));
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
