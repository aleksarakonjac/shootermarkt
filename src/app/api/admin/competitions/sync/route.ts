import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllCalendarEvents, normalizeEventName } from "@/lib/calendar/adapters";
import type { CalendarSource } from "@/lib/calendar/adapters";
import { detectCompetitionLevel, isRiflePistolCompetition } from "@/lib/issf/competition-level";
import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";
import { inArray, sql } from "drizzle-orm";
import type { CompetitionLevel } from "@/lib/pdf-import/types";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

const SOURCE_DEFAULT_LEVEL: Record<CalendarSource, CompetitionLevel | null> = {
  sss:  "national",
  esc:  "continental",
  issf: null,
};

function buildKey(source: CalendarSource, externalId: string | null, name: string, dateFrom: string | null, year: number): string {
  if (source === "issf" && externalId) return `issf:${externalId}`;
  if (source === "sss") return `sss:${normalizeEventName(name)}:${year}`;
  return `esc:${normalizeEventName(name)}:${dateFrom ?? year}`;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const year = parseInt(sp.get("year") ?? String(new Date().getFullYear()));
  const sourcesParam = sp.get("sources") ?? "issf,sss,esc";
  const sources = sourcesParam.split(",").filter((s): s is CalendarSource =>
    ["sss", "issf", "esc"].includes(s)
  );

  const events = await fetchAllCalendarEvents(year, sources);

  const filtered = events.filter((e) => {
    if (e.source !== "issf") return true;
    return isRiflePistolCompetition(undefined, e.name);
  });

  const withKeys = filtered.map((e) => ({
    ...e,
    key: buildKey(e.source, e.externalId, e.name, e.dateFrom, year),
  }));

  const seen = new Set<string>();
  const deduped = withKeys.filter((e) => {
    if (seen.has(e.key)) return false;
    seen.add(e.key);
    return true;
  });

  const issfIds = deduped.filter((e) => e.source === "issf" && e.externalId).map((e) => e.externalId!);
  const extIds = deduped.map((e) => e.key);

  const [existingIssf, existingExt] = await Promise.all([
    issfIds.length
      ? db.select({ issfId: competitions.issfId, tags: competitions.tags })
          .from(competitions).where(inArray(competitions.issfId, issfIds))
      : Promise.resolve([]),
    extIds.length
      ? db.select({ externalId: competitions.externalId, tags: competitions.tags })
          .from(competitions).where(inArray(competitions.externalId, extIds))
      : Promise.resolve([]),
  ]);

  const issfTagMap = new Map(existingIssf.map((r) => [r.issfId!, r.tags ?? []]));
  const extTagMap  = new Map(existingExt.map((r) => [r.externalId!, r.tags ?? []]));

  const result = deduped.map((e) => {
    const currentTags: string[] =
      (e.source === "issf" && e.externalId ? issfTagMap.get(e.externalId) : undefined)
      ?? extTagMap.get(e.key)
      ?? [];
    const alreadyInDb = currentTags !== undefined
      ? (e.source === "issf" && e.externalId ? issfTagMap.has(e.externalId) : false) || extTagMap.has(e.key)
      : false;

    return {
      key: e.key,
      source: e.source,
      name: e.name,
      dateFrom: e.dateFrom,
      dateTo: e.dateTo,
      location: e.location,
      country: e.country,
      issfId: e.source === "issf" ? e.externalId : null,
      competitionTypeId: e.competitionTypeId ?? null,
      competitionTypeName: e.competitionTypeName ?? null,
      competitionTypeAcronym: e.competitionTypeAcronym ?? null,
      detectedLevel: e.source === "issf"
        ? detectCompetitionLevel(e.competitionTypeId)
        : SOURCE_DEFAULT_LEVEL[e.source],
      alreadyInDb,
      currentTags,
    };
  });

  return NextResponse.json(result);
}

interface CommitEvent {
  key: string;
  source: CalendarSource;
  name: string;
  dateFrom: string;
  dateTo: string | null;
  location: string | null;
  issfId: string | null;
  level: CompetitionLevel;
}

const tagMergeSql = sql`array(SELECT DISTINCT unnest(array_cat(${competitions.tags}, EXCLUDED.tags)))`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { events } = (await req.json()) as { events: CommitEvent[] };
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: "Nema evenata" }, { status: 400 });
  }

  const toInsert = events.filter((e) => e.dateFrom);
  if (!toInsert.length) return NextResponse.json({ inserted: 0, skipped: events.length });

  const makeValue = (e: CommitEvent) => ({
    name: e.name,
    date: e.dateFrom,
    dateEnd: e.dateTo && e.dateTo !== e.dateFrom ? e.dateTo : null,
    location: e.location ?? null,
    level: e.level,
    organizer: e.source.toUpperCase(),
    externalId: e.key,
    tags: [e.source] as string[],
    ...(e.issfId ? { issfId: e.issfId } : {}),
  });

  // ISSF events: conflict on issf_id (unique column)
  const issfEvents = toInsert.filter((e) => e.issfId);
  // SSS/ESC events: conflict on external_id (partial unique index)
  const otherEvents = toInsert.filter((e) => !e.issfId);

  let insertedCount = 0;

  if (issfEvents.length) {
    const res = await db
      .insert(competitions)
      .values(issfEvents.map(makeValue))
      .onConflictDoUpdate({
        target: competitions.issfId,
        set: { tags: tagMergeSql },
      })
      .returning({ id: competitions.id });
    insertedCount += res.length;
  }

  if (otherEvents.length) {
    const res = await db
      .insert(competitions)
      .values(otherEvents.map(makeValue))
      .onConflictDoUpdate({
        target: competitions.externalId,
        targetWhere: sql`${competitions.externalId} IS NOT NULL`,
        set: { tags: tagMergeSql },
      })
      .returning({ id: competitions.id });
    insertedCount += res.length;
  }

  return NextResponse.json({ inserted: insertedCount, skipped: toInsert.length - insertedCount });
}
