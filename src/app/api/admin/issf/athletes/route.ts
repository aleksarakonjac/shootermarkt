import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchAthletes, fetchAthleteProfile, inferApparatus } from "@/lib/issf/adapter";
import { db } from "@/lib/db";
import { shooters } from "@/lib/db/schema";
import { inArray, eq } from "drizzle-orm";
import { uploadAvatarFromUrl } from "@/lib/avatars/upload-avatar";

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
    portraitUrl?: string;
  }> = body.athletes;

  if (!Array.isArray(selected) || selected.length === 0) {
    return NextResponse.json({ error: "Nema odabranih strelaca" }, { status: 400 });
  }

  // Fetch full profiles in parallel for real birthday + events
  const profiles = await Promise.all(selected.map((a) => fetchAthleteProfile(a.issfId)));
  const profileMap = new Map(profiles.map((p, i) => [selected[i].issfId, p]));

  const values = selected.map((a) => {
    const profile = profileMap.get(a.issfId) ?? {};
    const birthday = profile.birthday ?? a.birthday;
    // ISSF search returns Jan 1 as placeholder; profile has real date
    const fullDate = birthday ? birthday.slice(0, 10) : null;
    return {
      firstName: a.firstName,
      lastName: a.familyName,
      nationality: a.nationCode || null,
      gender: a.gender === "Male" ? "M" : a.gender === "Female" ? "F" : null,
      birthYear: fullDate ? new Date(fullDate).getFullYear() : null,
      birthDate: fullDate,
      apparatus: inferApparatus(profile.events),
      issfId: a.issfId,
      verified: false,
      createdBySelf: false,
    };
  });

  const inserted = await db
    .insert(shooters)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: shooters.id, issfId: shooters.issfId });

  // Upload avatars for newly inserted shooters (parallel, silent fail per shooter)
  if (inserted.length > 0) {
    const portraitMap = new Map(selected.map((a) => [a.issfId, a.portraitUrl]));
    await Promise.allSettled(
      inserted.map(async (s) => {
        const portraitUrl = s.issfId ? portraitMap.get(s.issfId) : undefined;
        if (!portraitUrl || !s.issfId) return;
        try {
          const avatarUrl = await uploadAvatarFromUrl(s.issfId, portraitUrl);
          await db
            .update(shooters)
            .set({ avatarUrl })
            .where(eq(shooters.id, s.id));
        } catch {
          // NoAvatarError or network error — skip silently
        }
      })
    );
  }

  return NextResponse.json({ inserted: inserted.length, skipped: selected.length - inserted.length });
}
