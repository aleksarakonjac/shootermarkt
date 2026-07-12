import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { shooters } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";
import { fetchAthleteProfile, inferApparatus } from "@/lib/issf/adapter";
import { eq } from "drizzle-orm";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

// GET: count how many shooters need enrichment
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({ id: shooters.id })
    .from(shooters)
    .where(
      isNotNull(shooters.issfId)
    );

  const needEnrich = rows.length;
  return NextResponse.json({ total: needEnrich });
}

// POST: enrich a batch of shooters
// body: { batchSize?: number, offset?: number }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(body.batchSize ?? 20, 50);
  const offset     = body.offset ?? 0;

  // Fetch shooters that need enrichment (have issfId, missing apparatus or birthDate)
  const rows = await db
    .select({ id: shooters.id, issfId: shooters.issfId })
    .from(shooters)
    .where(
      isNotNull(shooters.issfId)
    )
    .limit(batchSize)
    .offset(offset);

  if (!rows.length) {
    return NextResponse.json({ enriched: 0, done: true });
  }

  let enriched = 0;
  await Promise.all(
    rows.map(async (s) => {
      if (!s.issfId) return;
      try {
        const profile = await fetchAthleteProfile(s.issfId);
        const birthday = (profile as { birthday?: string }).birthday;
        const events   = (profile as { events?: string }).events;
        const fullDate = birthday ? birthday.slice(0, 10) : null;
        const apparatus = inferApparatus(events);

        const update: Record<string, unknown> = {};
        if (fullDate) {
          update.birthDate = fullDate;
          update.birthYear = new Date(fullDate).getFullYear();
        }
        if (apparatus) update.apparatus = apparatus;

        if (Object.keys(update).length > 0) {
          await db.update(shooters).set(update).where(eq(shooters.id, s.id));
          enriched++;
        }
      } catch {
        // skip silently
      }
    })
  );

  const done = rows.length < batchSize;
  return NextResponse.json({ enriched, processed: rows.length, done });
}
