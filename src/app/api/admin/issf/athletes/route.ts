import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchAthletes } from "@/lib/issf/adapter";
import { db } from "@/lib/db";
import { shooters } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);

  const athletes = await searchAthletes(q);

  // Mark which issfIds already exist in DB
  const issfIds = athletes.map((a) => a.issfId).filter(Boolean);
  const existing = issfIds.length
    ? await db
        .select({ issfId: shooters.issfId })
        .from(shooters)
        .where(inArray(shooters.issfId, issfIds))
    : [];
  const existingSet = new Set(existing.map((e) => e.issfId));

  return NextResponse.json(
    athletes.map((a) => ({
      ...a,
      alreadyInDb: existingSet.has(a.issfId),
    }))
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const selected: Array<{
    issfId: string;
    firstName: string;
    familyName: string;
    nationCode: string;
    gender: string;
    birthday: string;
  }> = body.athletes;

  if (!Array.isArray(selected) || selected.length === 0) {
    return NextResponse.json({ error: "Nema odabranih strelaca" }, { status: 400 });
  }

  const values = selected.map((a) => ({
    firstName: a.firstName,
    lastName: a.familyName,
    nationality: a.nationCode || null,
    gender: a.gender === "Male" ? "M" : a.gender === "Female" ? "F" : null,
    birthYear: a.birthday ? new Date(a.birthday).getFullYear() : null,
    issfId: a.issfId,
    verified: false,
    createdBySelf: false,
  }));

  const inserted = await db
    .insert(shooters)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: shooters.id, issfId: shooters.issfId });

  return NextResponse.json({ inserted: inserted.length, skipped: selected.length - inserted.length });
}
