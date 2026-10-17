import { groupsFromName } from "@/lib/competition-filters";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllCalendarEvents, normalizeEventName } from "@/lib/calendar/adapters";
import type { CalendarSource } from "@/lib/calendar/adapters";
import { detectCompetitionLevel, isRiflePistolCompetition } from "@shootermarkt/adapters/issf/competition-level";
import { db } from "@shootermarkt/db";
import { competitions, countries, competitionLevelEnum, eventTypeEnum, ageCategoryEnum } from "@shootermarkt/db/schema";
import { inArray, isNotNull, sql } from "drizzle-orm";
import { fetchSiusCompetitions } from "@shootermarkt/adapters/sius/public-adapter";
import { matchSiusCompetition, type SiusMatch } from "@/lib/sius-match";
import { FOCUS_PRIORITY_MAX, FOCUS_PRIORITY_MIN } from "@/lib/competition-priority";
import type { CompetitionLevel } from "@shootermarkt/db/pdf-import-types";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

const SOURCE_DEFAULT_LEVEL: Record<CalendarSource, CompetitionLevel | null> = {
  sss:  "national",
  esc:  "continental",
  issf: null,
};

async function loadCountryLookup() {
  const rows = await db
    .select({ id: countries.id, code: countries.code, code2: countries.code2, nocCode: countries.nocCode, name: countries.name })
    .from(countries);
  const ids = new Map<string, number>();
  for (const c of rows) {
    for (const v of [c.code, c.code2, c.nocCode, c.name]) if (v) ids.set(v.trim().toLowerCase(), c.id);
  }
  return (country: string | null | undefined) => ids.get(country?.trim().toLowerCase() ?? "") ?? null;
}

function buildKey(source: CalendarSource, externalId: string | null, name: string, dateFrom: string | null, year: number): string {
  if (source === "issf" && externalId) return `issf:${externalId}`;
  if (source === "sss") return `sss:${normalizeEventName(name)}:${year}`;
  return `esc:${normalizeEventName(name)}:${dateFrom ?? year}`;
}

// ── Cross-source fuzzy duplicate detection ────────────────────────────────────

function tokenize(name: string): Set<string> {
  return new Set(
    name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const intersection = [...ta].filter((w) => tb.has(w)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : intersection / union;
}

function datesClose(d1: string | null, d2: string | null, windowDays = 4): boolean {
  if (!d1 || !d2) return false;
  return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) <= windowDays * 86_400_000;
}

const SOURCE_PRIORITY: Record<CalendarSource, number> = { issf: 0, esc: 1, sss: 2 };

function detectConflictGroups(events: Array<{ key: string; source: CalendarSource; name: string; dateFrom: string | null }>): Map<string, string> {
  const groups = new Map<string, string>(); // key → groupId
  let counter = 0;

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i], b = events[j];
      if (a.source === b.source) continue;
      if (!datesClose(a.dateFrom, b.dateFrom)) continue;
      if (jaccardSimilarity(a.name, b.name) < 0.35) continue;

      const gA = groups.get(a.key);
      const gB = groups.get(b.key);
      const groupId = gA ?? gB ?? `conflict-${++counter}`;
      groups.set(a.key, groupId);
      groups.set(b.key, groupId);
    }
  }
  return groups;
}

/**
 * Auto-finds the SIUS UUID of ISSF calendar events by date + name/city (see lib/sius-match.ts).
 * Skips events that already have one, UUIDs used by another competition, and loses ties:
 * a UUID is suggested to only one event of the list (the best-scoring), so the commit never sees duplicates.
 */
async function suggestSiusLinks(
  events: Array<{ key: string; source: CalendarSource; externalId: string | null; name: string; dateFrom: string | null; location: string | null }>,
  linkedSiusId: (e: { key: string; source: CalendarSource; externalId: string | null }) => string | null,
): Promise<Map<string, SiusMatch>> {
  const candidates = events.filter((e) => e.source === "issf" && e.dateFrom);
  if (!candidates.length) return new Map();
  const from = candidates.reduce((min, e) => (e.dateFrom! < min ? e.dateFrom! : min), candidates[0].dateFrom!);
  let sius;
  try {
    sius = await fetchSiusCompetitions(new Date(Date.parse(from) - 7 * 86_400_000).toISOString().slice(0, 10));
  } catch (err) {
    console.warn("[sync] SIUS competitions lookup failed:", err);
    return new Map();
  }
  const taken = new Set((await db.select({ id: competitions.siusId }).from(competitions).where(isNotNull(competitions.siusId))).map((r) => r.id!));
  const matches: Array<[string, SiusMatch]> = [];
  for (const e of candidates) {
    if (linkedSiusId(e)) continue;
    const m = matchSiusCompetition({ name: e.name, date: e.dateFrom!, location: e.location }, sius, taken);
    if (m) matches.push([e.key, m]);
  }
  const bestById = new Map<string, [string, SiusMatch]>();
  for (const entry of matches) {
    const cur = bestById.get(entry[1].id);
    if (!cur || entry[1].score > cur[1].score) bestById.set(entry[1].id, entry);
  }
  return new Map([...bestById.values()]);
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
      ? db.select({ issfId: competitions.issfId, tags: competitions.tags, siusId: competitions.siusId })
          .from(competitions).where(inArray(competitions.issfId, issfIds))
      : Promise.resolve([]),
    extIds.length
      ? db.select({ externalId: competitions.externalId, tags: competitions.tags, siusId: competitions.siusId })
          .from(competitions).where(inArray(competitions.externalId, extIds))
      : Promise.resolve([]),
  ]);

  const issfTagMap = new Map(existingIssf.map((r) => [r.issfId!, r.tags ?? []]));
  const extTagMap  = new Map(existingExt.map((r) => [r.externalId!, r.tags ?? []]));

  const issfSiusMap = new Map(existingIssf.map((r) => [r.issfId!, r.siusId]));
  const extSiusMap  = new Map(existingExt.map((r) => [r.externalId!, r.siusId]));
  const siusSuggestions = await suggestSiusLinks(deduped, (e) =>
    (e.source === "issf" && e.externalId ? issfSiusMap.get(e.externalId) : undefined) ?? extSiusMap.get(e.key) ?? null);

  const conflictGroups = detectConflictGroups(deduped);
  const countryIdOf = await loadCountryLookup();

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
      countryId: countryIdOf(e.country),
      disciplineGroups: groupsFromName(e.name),
      issfId: e.source === "issf" ? e.externalId : null,
      siusSuggestion: siusSuggestions.get(e.key) ?? null,
      currentSiusId: (e.source === "issf" && e.externalId ? issfSiusMap.get(e.externalId) : undefined) ?? extSiusMap.get(e.key) ?? null,
      competitionTypeId: e.competitionTypeId ?? null,
      competitionTypeName: e.competitionTypeName ?? null,
      competitionTypeAcronym: e.competitionTypeAcronym ?? null,
      detectedLevel: e.source === "issf"
        ? detectCompetitionLevel(e.competitionTypeId)
        : SOURCE_DEFAULT_LEVEL[e.source],
      alreadyInDb,
      currentTags,
      conflictGroupId: conflictGroups.get(e.key) ?? null,
      conflictPriority: SOURCE_PRIORITY[e.source],
    };
  });

  return NextResponse.json(result);
}

interface CommitEvent {
  key: string;
  source: CalendarSource;
  name: string;
  nameSr?: string | null;
  nameEn?: string | null;
  dateFrom: string;
  dateTo: string | null;
  location: string | null;
  locationSr?: string | null;
  locationEn?: string | null;
  countryId: number | null;
  level: CompetitionLevel;
  eventType?: string;
  ageCategory?: string;
  focusPriority?: number | null;
  organizer?: string | null;
  issfId: string | null;
  siusId?: string | null;
  disciplineGroups?: string[];
  tags?: string[];
}

const tagMergeSql = sql`array(SELECT DISTINCT unnest(array_cat(${competitions.tags}, EXCLUDED.tags)))`;
const blank = (v: string | null | undefined) => v?.trim() || null;

function validate(e: CommitEvent): string | null {
  const label = e.name?.trim() || e.key;
  if (!e.name?.trim()) return `${e.key}: naziv je obavezan`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.dateFrom ?? "")) return `${label}: datum početka je obavezan`;
  if (e.dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(e.dateTo)) return `${label}: neispravan datum završetka`;
  if (e.dateTo && e.dateTo < e.dateFrom) return `${label}: kraj je pre početka`;
  if (!(competitionLevelEnum.enumValues as readonly string[]).includes(e.level)) return `${label}: nivo nije izabran`;
  if (e.eventType && !(eventTypeEnum.enumValues as readonly string[]).includes(e.eventType)) return `${label}: nepoznat tip`;
  if (e.ageCategory && !(ageCategoryEnum.enumValues as readonly string[]).includes(e.ageCategory)) return `${label}: nepoznata kategorija`;
  if (e.focusPriority != null && (!Number.isInteger(e.focusPriority) || e.focusPriority < FOCUS_PRIORITY_MIN || e.focusPriority > FOCUS_PRIORITY_MAX)) return `${label}: prioritet van opsega`;
  return null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { events } = (await req.json()) as { events: CommitEvent[] };
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: "Nema evenata" }, { status: 400 });
  }

  for (const e of events) {
    const problem = validate(e);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }

  // scius_id is unique but not an upsert target — report clashes instead of a 500 that aborts the batch.
  const siusIds = events.map((e) => blank(e.siusId)).filter((v): v is string => !!v);
  if (new Set(siusIds).size !== siusIds.length) {
    return NextResponse.json({ error: "SIUS UUID se ponavlja u listi" }, { status: 400 });
  }
  if (siusIds.length) {
    const takenRows = await db.select({ siusId: competitions.siusId, name: competitions.name, issfId: competitions.issfId, externalId: competitions.externalId })
      .from(competitions).where(inArray(competitions.siusId, siusIds));
    // A UUID already on the very same competition (re-sync) is fine; only another competition's UUID is a clash.
    const clashes = takenRows.filter((t) => !events.some((e) =>
      blank(e.siusId) === t.siusId && ((blank(e.issfId) && blank(e.issfId) === t.issfId) || e.key === t.externalId)));
    if (clashes.length) {
      return NextResponse.json({ error: `SIUS UUID već koristi: ${clashes.map((t) => t.name).join(", ")}` }, { status: 400 });
    }
  }

  const makeValue = (e: CommitEvent) => ({
    name: e.name.trim(),
    nameSr: blank(e.nameSr),
    nameEn: blank(e.nameEn),
    date: e.dateFrom,
    dateEnd: e.dateTo && e.dateTo !== e.dateFrom ? e.dateTo : null,
    location: blank(e.location),
    locationSr: blank(e.locationSr),
    locationEn: blank(e.locationEn),
    countryId: e.countryId ?? null,
    level: e.level,
    ...(e.eventType ? { eventType: e.eventType as (typeof eventTypeEnum.enumValues)[number] } : {}),
    ...(e.ageCategory ? { ageCategory: e.ageCategory as (typeof ageCategoryEnum.enumValues)[number] } : {}),
    focusPriority: e.focusPriority ?? null,
    organizer: blank(e.organizer) ?? e.source.toUpperCase(),
    externalId: e.key,
    tags: [...new Set([e.source, ...(e.tags ?? []).map((t) => t.trim()).filter(Boolean)])],
    disciplineGroups: e.disciplineGroups ?? groupsFromName(e.name),
    siusId: blank(e.siusId),
    ...(blank(e.issfId) ? { issfId: blank(e.issfId)! } : {}),
  });

  // ISSF events: conflict on issf_id (unique column)
  const issfEvents = events.filter((e) => blank(e.issfId));
  // SSS/ESC events: conflict on external_id (partial unique index)
  const otherEvents = events.filter((e) => !blank(e.issfId));

  let insertedCount = 0;

  try {
    if (issfEvents.length) {
      const res = await db
        .insert(competitions)
        .values(issfEvents.map(makeValue))
        .onConflictDoUpdate({
          target: competitions.issfId,
          set: {
            tags: tagMergeSql,
            countryId: sql`COALESCE(${competitions.countryId}, EXCLUDED.country_id)`,
            siusId: sql`COALESCE(${competitions.siusId}, EXCLUDED.scius_id)`,
          },
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
          set: {
            tags: tagMergeSql,
            countryId: sql`COALESCE(${competitions.countryId}, EXCLUDED.country_id)`,
            siusId: sql`COALESCE(${competitions.siusId}, EXCLUDED.scius_id)`,
          },
        })
        .returning({ id: competitions.id });
      insertedCount += res.length;
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Greška pri upisu" }, { status: 500 });
  }

  return NextResponse.json({ inserted: insertedCount, skipped: events.length - insertedCount });
}
