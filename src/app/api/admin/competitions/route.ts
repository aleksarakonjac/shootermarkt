import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await db
    .select()
    .from(competitions)
    .orderBy(desc(competitions.date));

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, date, location, level, issfId } = body;

  if (!name?.trim() || !date || !level) {
    return NextResponse.json({ error: "Naziv, datum i nivo su obavezni" }, { status: 400 });
  }

  const [comp] = await db
    .insert(competitions)
    .values({
      name: name.trim(),
      date,
      location: location?.trim() || null,
      level: level as CompetitionLevel,
      issfId: issfId ? String(issfId) : null,
    })
    .onConflictDoNothing()
    .returning({ id: competitions.id, name: competitions.name });

  if (!comp) {
    return NextResponse.json({ error: "Takmičenje već postoji" }, { status: 409 });
  }

  return NextResponse.json({ id: comp.id, name: comp.name });
}
