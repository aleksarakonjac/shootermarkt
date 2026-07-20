import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAthleteProfile, inferApparatus } from "@/lib/issf/adapter";
import { db } from "@/lib/db";
import { shooters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { uploadAvatarFromUrl } from "@/lib/avatars/upload-avatar";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { issfId, nationCode } = await req.json() as { issfId: string; nationCode?: string };
  if (!issfId) return NextResponse.json({ error: "issfId required" }, { status: 400 });

  const profile = await fetchAthleteProfile(issfId);

  const fullDate = profile.birthday ? profile.birthday.slice(0, 10) : null;
  const apparatus = inferApparatus(profile.events);

  const [inserted] = await db
    .insert(shooters)
    .values({
      firstName: profile.firstName ?? "",
      lastName: profile.familyName ?? "",
      nationality: profile.nationCode ?? nationCode ?? null,
      gender: profile.gender === "Male" ? "M" : profile.gender === "Female" ? "F" : null,
      birthYear: fullDate ? new Date(fullDate).getFullYear() : null,
      birthDate: fullDate,
      apparatus,
      issfId,
      verified: false,
      createdBySelf: false,
    })
    .onConflictDoNothing()
    .returning({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      nationality: shooters.nationality,
      birthYear: shooters.birthYear,
      apparatus: shooters.apparatus,
      avatarUrl: shooters.avatarUrl,
      issfId: shooters.issfId,
    });

  if (!inserted) {
    const existing = await db.query.shooters.findFirst({ where: eq(shooters.issfId, issfId) });
    if (!existing) return NextResponse.json({ error: "Insert conflict, shooter not found" }, { status: 500 });
    return NextResponse.json({ shooter: existing, created: false });
  }

  if (profile.portraitUrl) {
    try {
      const avatarUrl = await uploadAvatarFromUrl(issfId, profile.portraitUrl);
      await db.update(shooters).set({ avatarUrl }).where(eq(shooters.id, inserted.id));
      inserted.avatarUrl = avatarUrl;
    } catch { /* silent */ }
  }

  return NextResponse.json({ shooter: inserted, created: true });
}
