import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shooters, results } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const shooterId = parseInt(id);
  if (isNaN(shooterId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json();
  const { firstName, lastName, nationality, gender, birthYear, clubId } = body;

  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: "Ime i prezime su obavezni" }, { status: 400 });
  }

  await db.update(shooters).set({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    nationality: nationality?.trim() || null,
    gender: gender || null,
    birthYear: birthYear ? parseInt(birthYear) : null,
    clubId: clubId ? parseInt(clubId) : null,
  }).where(eq(shooters.id, shooterId));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const shooterId = parseInt(id);
  if (isNaN(shooterId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  // Block delete if shooter has results
  const [existing] = await db.select({ id: results.id }).from(results).where(eq(results.shooterId, shooterId)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "Strelac ima rezultate, ne može se obrisati" }, { status: 409 });
  }

  await db.delete(shooters).where(eq(shooters.id, shooterId));
  return NextResponse.json({ ok: true });
}
