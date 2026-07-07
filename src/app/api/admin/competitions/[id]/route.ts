import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { competitions, results } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const compId = parseInt(id);
  if (isNaN(compId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const { name, nameSr, nameEn, date, dateEnd, location, level } = body;

  if (!name?.trim() || !date || !level) {
    return NextResponse.json({ error: "Naziv, datum i nivo su obavezni" }, { status: 400 });
  }

  const [updated] = await db
    .update(competitions)
    .set({
      name: name.trim(),
      nameSr: nameSr?.trim() || null,
      nameEn: nameEn?.trim() || null,
      date,
      dateEnd: dateEnd?.trim() && dateEnd.trim() !== date ? dateEnd.trim() : null,
      location: location?.trim() || null,
      level: level as CompetitionLevel,
    })
    .where(eq(competitions.id, compId))
    .returning({ id: competitions.id });

  if (!updated) return NextResponse.json({ error: "Nije pronađeno" }, { status: 404 });

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const compId = parseInt(id);
  if (isNaN(compId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  // Delete results first (no CASCADE in schema)
  await db.delete(results).where(eq(results.competitionId, compId));
  await db.delete(competitions).where(eq(competitions.id, compId));

  return NextResponse.json({ ok: true });
}
