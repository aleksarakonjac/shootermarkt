import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { fetchSiusCompetitions } from "@shootermarkt/adapters/sius/public-adapter";
import { pickSiusLinks } from "@/lib/sius-match";

const DAY = 86_400_000;

/**
 * Finds and stores the SIUS UUID of competitions that start today or tomorrow (calendar date) and lack one.
 * Runs from the schedule-sync cron, so a competition is retried the day before and the day it starts.
 */
export async function autoLinkSius(now = new Date()): Promise<Map<number, string>> {
  const [today, tomorrow] = [0, 1].map((days) => new Date(now.getTime() + days * DAY).toISOString().slice(0, 10));
  const targets = await db
    .select({ id: competitions.id, name: competitions.name, date: competitions.date, location: competitions.location })
    .from(competitions)
    .where(and(isNull(competitions.siusId), inArray(competitions.date, [today, tomorrow])));
  if (!targets.length) return new Map();

  // Nedelju dana unazad — matchSiusCompetition gleda ±5 dana
  const sius = await fetchSiusCompetitions(new Date(now.getTime() - 7 * DAY).toISOString().slice(0, 10));
  const taken = new Set((await db.select({ id: competitions.siusId }).from(competitions).where(isNotNull(competitions.siusId))).map((r) => r.id!));

  const links = pickSiusLinks(targets, sius, taken);
  for (const [id, siusId] of links) {
    await db.update(competitions).set({ siusId }).where(and(eq(competitions.id, id), isNull(competitions.siusId)));
    console.log(`[sius-autolink] competition ${id} → ${siusId}`);
  }
  return links;
}
