import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { shooters, results } from "@shootermarkt/db/schema";
import { createClient } from "@/lib/supabase/server";
import { inArray, eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { nationalities } = await req.json() as { nationalities: string[] };
  if (!Array.isArray(nationalities) || nationalities.length === 0) {
    return NextResponse.json({ error: "Nema nacionalnosti" }, { status: 400 });
  }

  // Only delete unverified, not-self-registered, with no results
  const shootersWithResults = await db
    .select({ id: results.shooterId })
    .from(results);
  const withResultIds = new Set(shootersWithResults.map((r) => r.id));

  const candidates = await db
    .select({ id: shooters.id })
    .from(shooters)
    .where(
      and(
        inArray(shooters.nationality, nationalities),
        eq(shooters.verified, false),
        eq(shooters.createdBySelf, false),
      )
    );

  const toDelete = candidates
    .filter((s) => !withResultIds.has(s.id))
    .map((s) => s.id);

  if (toDelete.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  await db.delete(shooters).where(inArray(shooters.id, toDelete));

  return NextResponse.json({ deleted: toDelete.length });
}
