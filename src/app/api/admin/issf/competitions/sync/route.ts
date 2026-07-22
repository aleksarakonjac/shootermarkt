import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCompetitions } from "@/lib/issf/adapter";
import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import type { CompetitionLevel } from "@/lib/pdf-import/types";
import { guessTimezone } from "@/lib/timezone";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));
  const issfComps = await fetchCompetitions(year);

  const rifle_pistol = issfComps.filter(
    (c) =>
      c.name.toLowerCase().includes("rifle") ||
      c.name.toLowerCase().includes("pistol") ||
      c.name.toLowerCase().includes("10m")
  );

  const issfIds = rifle_pistol.map((c) => String(c.id));
  const existing = issfIds.length
    ? await db
        .select({ issfId: competitions.issfId, id: competitions.id })
        .from(competitions)
        .where(inArray(competitions.issfId, issfIds))
    : [];
  const existingSet = new Set(existing.map((e) => e.issfId));

  return NextResponse.json(
    rifle_pistol.map((c) => ({
      ...c,
      alreadyInDb: existingSet.has(String(c.id)),
    }))
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const selected: Array<{
    id: number;
    name: string;
    dateFrom: string;
    city: string;
    nationCode?: string;
    level?: CompetitionLevel;
  }> = body.competitions;

  if (!Array.isArray(selected) || selected.length === 0) {
    return NextResponse.json({ error: "Nema odabranih takmičenja" }, { status: 400 });
  }

  const values = selected.map((c) => ({
    name: c.name,
    date: c.dateFrom.split("T")[0],
    location: c.city,
    level: (c.level ?? "medjunarodno") as CompetitionLevel,
    issfId: String(c.id),
    timezone: guessTimezone(c.city, c.nationCode ?? null),
  }));

  const inserted = await db
    .insert(competitions)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: competitions.id });

  return NextResponse.json({ inserted: inserted.length, skipped: selected.length - inserted.length });
}
