import { fetchAllCalendarEvents, normalizeEventName } from "./adapters";
import { db } from "@/lib/db";
import { calendarAlerts, competitions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface SyncResult {
  newAlerts: number;
  checkedYears: number[];
  errors: string[];
}

export async function runCalendarSync(): Promise<SyncResult> {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];
  let newAlerts = 0;
  const errors: string[] = [];

  for (const year of years) {
    let events;
    try {
      events = await fetchAllCalendarEvents(year);
    } catch (e) {
      errors.push(`Year ${year}: ${e}`);
      continue;
    }

    const existingComps = await db
      .select({ name: competitions.name })
      .from(competitions);
    const existingNormalized = new Set(existingComps.map((c) => normalizeEventName(c.name)));

    const existingAlerts = await db
      .select({ eventName: calendarAlerts.eventName, source: calendarAlerts.source })
      .from(calendarAlerts)
      .where(eq(calendarAlerts.seen, false));
    const existingAlertKeys = new Set(
      existingAlerts.map((a) => `${a.source}::${normalizeEventName(a.eventName)}`)
    );

    const newEvents = events.filter((e) => {
      if (!e.is10m) return false;
      const norm = normalizeEventName(e.name);
      if (existingNormalized.has(norm)) return false;
      if (existingAlertKeys.has(`${e.source}::${norm}`)) return false;
      return true;
    });

    if (newEvents.length > 0) {
      await db.insert(calendarAlerts).values(
        newEvents.map((e) => ({
          source: e.source,
          eventName: e.name,
          changeType: "new" as const,
          data: {
            dateFrom: e.dateFrom ?? undefined,
            dateTo: e.dateTo ?? undefined,
            location: e.location ?? undefined,
            country: e.country ?? undefined,
            url: e.url ?? undefined,
            externalId: e.externalId ?? undefined,
          },
          seen: false,
        }))
      );
      newAlerts += newEvents.length;
    }
  }

  return { newAlerts, checkedYears: years, errors };
}
