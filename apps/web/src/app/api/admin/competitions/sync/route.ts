import { groupsFromName } from "@/lib/competition-filters";
import { NextRequest, NextResponse } from "next/server";
import { fetchAllCalendarEvents, normalizeEventName } from "@/lib/calendar/adapters";
import type { CalendarSource } from "@/lib/calendar/adapters";
import { detectCompetitionLevel, isRiflePistolCompetition } from "@shootermarkt/adapters/issf/competition-level";
import { db } from "@shootermarkt/db";
import { competitions, countries, competitionLevelEnum, eventTypeEnum, ageCategoryEnum } from "@shootermarkt/db/schema";
import { and, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { fetchSiusCompetitions } from "@shootermarkt/adapters/sius/public-adapter";
import { matchSiusCompetition, type SiusMatch } from "@/lib/sius-match";
import { nameSimilarity } from "@/lib/name-similarity";
import { FOCUS_PRIORITY_MAX, FOCUS_PRIORITY_MIN } from "@/lib/competition-priority";
import type { CompetitionLevel } from "@shootermarkt/db/pdf-import-types";
import { requireAdmin } from "@/lib/admin-auth";
import { revalidatesPublicSite } from "@/lib/revalidate-public";

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
      if (nameSimilarity(a.name, b.name) < 0.35) continue;

      const gA = groups.get(a.key);
      const gB = groups.get(b.key);
      const groupId = gA ?? gB ?? `conflict-${++counter}`;
      groups.set(a.key, groupId);
      groups.set(b.key, groupId);
    }
  }
  return groups;
}

const ISSF_LEVELS = ["international", "continental", "world", "olympic"] as const;

export interface DbMatch {
  id: number;
  name: string;
  date: string;
  siusId: string | null;
  score: number;
  /** Strong enough to link by default; weaker matches are only offered. */
  confident: boolean;
}

/**
 * ISSF events not yet in the DB are matched against competitions that have no ISSF id
 * (entered by hand, or from SSS/ESC) by start date (±4 days) and name similarity, so the import
 * can complete the existing row instead of inserting a duplicate. Each DB row goes to one event only.
 */
async function findDbMatches(events: Array<{ key: string; source: CalendarSource; name: string; dateFrom: string | null }>): Promise<Map<string, DbMatch>> {
  const candidates = events.filter((e) => e.source === "issf" && e.dateFrom);
  if (!candidates.length) return new Map();
  const dates = candidates.map((e) => Date.parse(e.dateFrom!));
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const rows = await db
    .select({ id: competitions.id, name: competitions.name, date: competitions.date, level: competitions.level, siusId: competitions.siusId })
    .from(competitions)
    .where(and(isNull(competitions.issfId), gte(competitions.date, day(Math.min(...dates) - 5 * 86_400_000)), lte(competitions.date, day(Math.max(...dates) + 5 * 86_400_000))));

  const pairs: Array<{ key: string; match: DbMatch }> = [];
  for (const e of candidates) {
    for (const r of rows) {
      if (!datesClose(e.dateFrom, r.date)) continue;
      let score = nameSimilarity(e.name, r.name);
      // Names in another language ("Juniorski Svetski kup" vs "ISSF Junior World Cup") share no words:
      // an international DB row in the same ±4-day window is still offered, but never linked by default.
      if (score < 0.35 && (ISSF_LEVELS as readonly string[]).includes(r.level)) score = 0.3;
      if (score < 0.3) continue;
      pairs.push({ key: e.key, match: { id: r.id, name: r.name, date: r.date, siusId: r.siusId, score, confident: score >= 0.5 } });
    }
  }
  pairs.sort((a, b) => b.match.score - a.match.score);
  const out = new Map<string, DbMatch>();
  const usedRows = new Set<number>();
  for (const { key, match } of pairs) {
    if (out.has(key) || usedRows.has(match.id)) continue;
    out.set(key, match);
    usedRows.add(match.id);
  }
  return out;
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
  const denied = await requireAdmin();
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const year = parseInt(sp.get("year") ?? String(new Date().getFullYear()));
  const sourcesParam = sp.get("sources") ?? "issf,sss,esc";
  const sources = sourcesParam.split(",").filter((s): s is CalendarSource =>
    ["sss", "issf", "esc"].includes(s)
  );

  const events = await fetchAllCalendarEvents(year, sources);

  const filtered = events.filter((e) => {
    if (e.source !== "issf") return true;
    return isRiflePistolCompetition(e.disciplines, e.name);
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
  const dbMatches = await findDbMatches(deduped.filter((e) => !(e.externalId && issfSiusMap.has(e.externalId)) && !extSiusMap.has(e.key)));
  const linkedSiusId = (e: { key: string; source: CalendarSource; externalId: string | null }) =>
    (e.source === "issf" && e.externalId ? issfSiusMap.get(e.externalId) : undefined) ?? extSiusMap.get(e.key) ?? dbMatches.get(e.key)?.siusId ?? null;
  const siusSuggestions = await suggestSiusLinks(deduped, linkedSiusId);

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
      currentSiusId: linkedSiusId(e),
      dbMatch: dbMatches.get(e.key) ?? null,
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
  /** Complete this existing competition (ISSF id, SIUS UUID, tag) instead of inserting a new one. */
  linkCompetitionId?: number | null;
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

async function handlePOST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

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
    const takenRows = await db.select({ id: competitions.id, siusId: competitions.siusId, name: competitions.name, issfId: competitions.issfId, externalId: competitions.externalId })
      .from(competitions).where(inArray(competitions.siusId, siusIds));
    // A UUID already on the very same competition (re-sync) is fine; only another competition's UUID is a clash.
    const clashes = takenRows.filter((t) => !events.some((e) =>
      blank(e.siusId) === t.siusId && ((blank(e.issfId) && blank(e.issfId) === t.issfId) || e.key === t.externalId || e.linkCompetitionId === t.id)));
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

  const linkEvents = events.filter((e) => e.linkCompetitionId);
  const newEvents = events.filter((e) => !e.linkCompetitionId);

  // issf_id is unique: refuse to link an ISSF id that another competition already carries.
  const linkIssfIds = linkEvents.map((e) => blank(e.issfId)).filter((v): v is string => !!v);
  if (linkIssfIds.length) {
    const owners = await db.select({ id: competitions.id, name: competitions.name, issfId: competitions.issfId })
      .from(competitions).where(inArray(competitions.issfId, linkIssfIds));
    const clash = owners.find((o) => !linkEvents.some((e) => e.linkCompetitionId === o.id && blank(e.issfId) === o.issfId));
    if (clash) return NextResponse.json({ error: `ISSF ID ${clash.issfId} već ima takmičenje „${clash.name}"` }, { status: 400 });
  }

  // ISSF events: conflict on issf_id (unique column)
  const issfEvents = newEvents.filter((e) => blank(e.issfId));
  // SSS/ESC events: conflict on external_id (partial unique index)
  const otherEvents = newEvents.filter((e) => !blank(e.issfId));

  let insertedCount = 0;
  let linkedCount = 0;

  try {
    // Linking only fills what is missing — the admin's name, dates and level on the existing row stay.
    for (const e of linkEvents) {
      const res = await db.update(competitions).set({
        issfId: sql`COALESCE(${competitions.issfId}, ${blank(e.issfId)})`,
        siusId: sql`COALESCE(${competitions.siusId}, ${blank(e.siusId)})`,
        countryId: sql`COALESCE(${competitions.countryId}, ${e.countryId ?? null}::int)`,
        tags: sql`array(SELECT DISTINCT unnest(array_append(${competitions.tags}, ${e.source}::varchar)))`,
      }).where(eq(competitions.id, e.linkCompetitionId!)).returning({ id: competitions.id });
      linkedCount += res.length;
    }

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

  return NextResponse.json({ inserted: insertedCount, linked: linkedCount, skipped: events.length - insertedCount - linkedCount });
}

export const POST = revalidatesPublicSite(handlePOST);
