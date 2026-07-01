import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchAthletes } from "@/lib/issf/adapter";
import { db } from "@/lib/db";
import { shooters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { uploadAvatarFromUrl } from "@/lib/avatars/upload-avatar";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

function hasScriptSecret(req: NextRequest) {
  const secret = process.env.IMPORT_SECRET;
  return secret && req.headers.get("x-import-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!hasScriptSecret(req)) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { noc } = await req.json();
  if (!noc?.trim()) return NextResponse.json({ error: "NOC kod je obavezan" }, { status: 400 });

  let athletes;
  try {
    athletes = await searchAthletes(noc.trim());
  } catch {
    return NextResponse.json({ inserted: 0, skipped: 0, total: 0 });
  }
  const filtered = athletes.filter((a) => a.nationCode === noc.trim());

  if (!filtered.length) {
    return NextResponse.json({ inserted: 0, skipped: 0, total: 0 });
  }

  // Deduplicate by issfId within batch, skip athletes missing required fields
  const seen = new Set<string>();
  const deduped = filtered
    .filter((a) => a.firstName?.trim() && a.familyName?.trim() && a.issfId)
    .filter((a) => {
      if (seen.has(a.issfId)) return false;
      seen.add(a.issfId);
      return true;
    });

  if (!deduped.length) {
    return NextResponse.json({ inserted: 0, skipped: filtered.length, total: filtered.length });
  }

  const values = deduped.map((a) => ({
    firstName: a.firstName.trim(),
    lastName: a.familyName.trim(),
    nationality: a.nationCode || null,
    gender: a.gender === "Male" ? "M" : a.gender === "Female" ? "F" : null,
    birthYear: a.birthday ? new Date(a.birthday).getFullYear() : null,
    issfId: a.issfId,
    verified: false,
    createdBySelf: false,
  }));

  let inserted;
  try {
    inserted = await db
      .insert(shooters)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: shooters.id, issfId: shooters.issfId });
  } catch (err) {
    console.error(`[bulk-nation] DB insert failed for ${noc}:`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  // Upload avatars for newly inserted shooters (parallel, silent fail per shooter)
  if (inserted.length > 0) {
    const portraitMap = new Map(deduped.map((a) => [a.issfId, a.portraitUrl]));
    await Promise.allSettled(
      inserted.map(async (s) => {
        const portraitUrl = s.issfId ? portraitMap.get(s.issfId) : undefined;
        if (!portraitUrl || !s.issfId) return;
        try {
          const avatarUrl = await uploadAvatarFromUrl(s.issfId, portraitUrl);
          await db.update(shooters).set({ avatarUrl }).where(eq(shooters.id, s.id));
        } catch {
          // NoAvatarError or network error — skip silently
        }
      })
    );
  }

  return NextResponse.json({
    inserted: inserted.length,
    skipped: deduped.length - inserted.length,
    total: deduped.length,
  });
}
