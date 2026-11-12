import { NextRequest, NextResponse } from "next/server";
import { db } from "@shootermarkt/db";
import { competitions, competitionSchedule, disciplines } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";

import { fetchScheduleFromHtml, type ISSFScheduleEntry } from "@shootermarkt/adapters/issf/adapter";
import { entriesToExtras, entriesToSlots, replaceExtras } from "@/lib/schedule-sync";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

// GET /api/admin/issf/schedule?issfId=3574&year=2026
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const issfId = parseInt(req.nextUrl.searchParams.get("issfId") ?? "");
  const year   = parseInt(req.nextUrl.searchParams.get("year") ?? "") || new Date().getFullYear();

  if (!issfId) return NextResponse.json({ error: "issfId required" }, { status: 400 });

  const entries = await fetchScheduleFromHtml(issfId, year);
  return NextResponse.json(entries);
}

// POST /api/admin/issf/schedule
// Body: { dbCompetitionId: number, entries: ISSFScheduleEntry[] }
async function handlePOST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json() as { dbCompetitionId: number; entries: ISSFScheduleEntry[] };
  const { dbCompetitionId, entries } = body;

  if (!dbCompetitionId || !entries?.length) {
    return NextResponse.json({ error: "dbCompetitionId and entries required" }, { status: 400 });
  }

  // Get competition timezone for correct UTC conversion
  const comp = await db.select({ timezone: competitions.timezone })
    .from(competitions)
    .where(eq(competitions.id, dbCompetitionId))
    .then((r) => r[0]);
  const timezone = comp?.timezone ?? "UTC";

  // Isti prevod kao u automatskom uvozu (schedule-sync): kategorija iz naslova, treninzi/ceremonije se ne uvoze
  // kao termini takmičenja (ranije su postajali "kvalifikacije" i dupirali raspored).
  const discRows = await db.select({ id: disciplines.id, code: disciplines.code }).from(disciplines);
  const codeToId = Object.fromEntries(discRows.map((d) => [d.code, d.id]));
  const toInsert = entriesToSlots(entries, timezone, codeToId).map((s) => ({ ...s, competitionId: dbCompetitionId }));
  const extras = entriesToExtras(entries, timezone, codeToId);

  if (!toInsert.length && !extras.length) {
    return NextResponse.json({ error: "No valid entries to import" }, { status: 400 });
  }

  // Tabela nema unique ograničenje, pa onConflictDoNothing ne bi ništa sprečio: ponovni import
  // bi dupirao ceo raspored. Preskačemo termine koji već postoje (isti meč, faza, kategorija, početak).
  const slotKey = (s: { disciplineId: number; stage: string; category: string; startTime: Date }) =>
    `${s.disciplineId}|${s.stage}|${s.category}|${s.startTime.getTime()}`;
  const existing = await db.select({
    disciplineId: competitionSchedule.disciplineId, stage: competitionSchedule.stage,
    category: competitionSchedule.category, startTime: competitionSchedule.startTime,
  }).from(competitionSchedule).where(eq(competitionSchedule.competitionId, dbCompetitionId));
  const seen = new Set(existing.map(slotKey));
  const fresh = toInsert.filter((s) => {
    const key = slotKey(s);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const inserted = fresh.length
    ? await db.insert(competitionSchedule).values(fresh).returning({ id: competitionSchedule.id })
    : [];
  // Stavke van takmičenja: isti naslov u isto vreme se preskače (unique indeks), pa je ponovni uvoz bezbedan.
  await replaceExtras(dbCompetitionId, extras);

  return NextResponse.json({ imported: inserted.length, skipped: toInsert.length - inserted.length, extras: extras.length });
}

export const POST = revalidatesPublicSite(handlePOST);
