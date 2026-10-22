import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitions, competitionSchedule, competitionScheduleChanges, countries, disciplines } from "@shootermarkt/db/schema";
import { fetchScheduleFromHtml, type ISSFScheduleEntry } from "@shootermarkt/adapters/issf/adapter";
import { timezoneForVenue, venueLocalToUtc } from "./timezone";

export interface Slot {
  disciplineId: number;
  stage: string;
  category: "senior" | "junior";
  startTime: Date;
  endTime: Date | null;
}

export type SlotChange =
  | { kind: "added"; after: Slot }
  | { kind: "removed"; before: Slot }
  | { kind: "changed"; before: Slot; after: Slot };

const same = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
const key = (s: Slot) => `${s.disciplineId}|${s.stage}|${s.category}`;

/** Identical slots cancel out; leftovers in the same (discipline, stage, category) pair up by start order as "changed". */
export function diffSlots(before: Slot[], after: Slot[]): SlotChange[] {
  const left = [...before];
  const added: Slot[] = [];
  for (const a of after) {
    const i = left.findIndex((b) => key(b) === key(a) && same(b.startTime, a.startTime) && same(b.endTime, a.endTime));
    if (i >= 0) left.splice(i, 1);
    else added.push(a);
  }
  const byTime = (x: Slot, y: Slot) => x.startTime.getTime() - y.startTime.getTime();
  const changes: SlotChange[] = [];
  const remaining = [...left].sort(byTime);
  for (const a of added.sort(byTime)) {
    const i = remaining.findIndex((b) => key(b) === key(a));
    if (i >= 0) changes.push({ kind: "changed", before: remaining.splice(i, 1)[0], after: a });
    else changes.push({ kind: "added", after: a });
  }
  for (const b of remaining) changes.push({ kind: "removed", before: b });
  return changes;
}

const isJunior = (title: string) => /\bjunior\b/i.test(title);

export function entriesToSlots(entries: ISSFScheduleEntry[], timezone: string, codeToId: Record<string, number>): Slot[] {
  return entries
    .filter((e) => e.disciplineCode && codeToId[e.disciplineCode] && e.startTime && !["training", "ceremony", "other"].includes(e.stage))
    .map((e) => ({
      disciplineId: codeToId[e.disciplineCode!],
      stage: e.stage,
      category: isJunior(e.eventTitle) ? "junior" as const : "senior" as const,
      startTime: venueLocalToUtc(e.date, e.startTime, timezone),
      endTime: e.endTime ? venueLocalToUtc(e.date, e.endTime, timezone) : null,
    }));
}

export interface SyncResult { competitionId: number; status: "empty" | "no_tz" | "first" | "unchanged" | "updated" | "error"; changes: number }

export async function syncCompetitionSchedule(comp: {
  id: number; issfId: string; date: string; location: string | null; timezone: string; noc: string | null;
}): Promise<SyncResult> {
  let timezone = comp.timezone;
  if (timezone === "UTC") {
    const guess = timezoneForVenue(comp.location, comp.noc);
    if (!guess) {
      const open = await db.select({ id: competitionScheduleChanges.id }).from(competitionScheduleChanges)
        .where(and(eq(competitionScheduleChanges.competitionId, comp.id), eq(competitionScheduleChanges.kind, "tz_missing"), isNull(competitionScheduleChanges.acknowledgedAt)));
      if (!open.length) await db.insert(competitionScheduleChanges).values({ competitionId: comp.id, kind: "tz_missing" });
      return { competitionId: comp.id, status: "no_tz", changes: 0 };
    }
    timezone = guess;
    await db.update(competitions).set({ timezone }).where(eq(competitions.id, comp.id));
  }

  let entries: ISSFScheduleEntry[];
  try {
    entries = await fetchScheduleFromHtml(parseInt(comp.issfId), parseInt(comp.date.slice(0, 4)));
  } catch (e) {
    console.error("[schedule-sync] fetch failed", comp.id, e);
    return { competitionId: comp.id, status: "error", changes: 0 };
  }

  const discRows = await db.select({ id: disciplines.id, code: disciplines.code }).from(disciplines);
  const codeToId = Object.fromEntries(discRows.map((d) => [d.code, d.id]));
  const after = entriesToSlots(entries, timezone, codeToId);
  if (!after.length) return { competitionId: comp.id, status: "empty", changes: 0 }; // not published yet — keep what we have

  const existing = await db.select().from(competitionSchedule).where(eq(competitionSchedule.competitionId, comp.id));
  const before: Slot[] = existing.map((r) => ({
    disciplineId: r.disciplineId, stage: r.stage, category: r.category as Slot["category"], startTime: r.startTime, endTime: r.endTime,
  }));
  const changes = diffSlots(before, after);
  if (!changes.length) return { competitionId: comp.id, status: "unchanged", changes: 0 };

  await db.transaction(async (tx) => {
    await tx.delete(competitionSchedule).where(eq(competitionSchedule.competitionId, comp.id));
    await tx.insert(competitionSchedule).values(after.map((s) => ({ ...s, competitionId: comp.id })));
    if (before.length) {
      await tx.insert(competitionScheduleChanges).values(changes.map((c) => {
        const b = "before" in c ? c.before : null, a = "after" in c ? c.after : null, ref = (a ?? b)!;
        return {
          competitionId: comp.id, kind: c.kind, disciplineId: ref.disciplineId, stage: ref.stage, category: ref.category,
          beforeStart: b?.startTime ?? null, beforeEnd: b?.endTime ?? null, afterStart: a?.startTime ?? null, afterEnd: a?.endTime ?? null,
        };
      }));
    }
  });
  return { competitionId: comp.id, status: before.length ? "updated" : "first", changes: before.length ? changes.length : 0 };
}

/** ISSF competitions starting within `aheadDays`, or running / ended within `behindDays`. */
export async function syncUpcomingSchedules(aheadDays = 14, behindDays = 1): Promise<SyncResult[]> {
  const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
  const rows = await db
    .select({ id: competitions.id, issfId: competitions.issfId, date: competitions.date, dateEnd: competitions.dateEnd, location: competitions.location, timezone: competitions.timezone, noc: countries.nocCode })
    .from(competitions).leftJoin(countries, eq(competitions.countryId, countries.id))
    .where(inArray(competitions.level, ["world", "olympic", "continental"]));
  const from = day(-behindDays), to = day(aheadDays);
  const results: SyncResult[] = [];
  for (const r of rows) {
    if (!r.issfId || r.date > to || (r.dateEnd ?? r.date) < from) continue;
    results.push(await syncCompetitionSchedule({ ...r, issfId: r.issfId }));
  }
  return results;
}

export async function syncCompetitionById(id: number): Promise<SyncResult | null> {
  const [r] = await db
    .select({ id: competitions.id, issfId: competitions.issfId, date: competitions.date, location: competitions.location, timezone: competitions.timezone, noc: countries.nocCode })
    .from(competitions).leftJoin(countries, eq(competitions.countryId, countries.id))
    .where(eq(competitions.id, id));
  return r?.issfId ? syncCompetitionSchedule({ ...r, issfId: r.issfId }) : null;
}
