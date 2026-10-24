import { sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitionEvents } from "@shootermarkt/db/schema";

/** Naziv ponovljenog meča bez sopstvenog imena: "2. meč · 22.01." (datum razdvaja seniore/juniore koji pucaju različitih dana). */
export function matchEventName(match: number, date: string): string {
  const [, m, d] = date.split("-");
  return `${match}. meč · ${d}.${m}.`;
}

/** Pronađi ili kreiraj zaseban meč istog takmičenja (competition_events) po nazivu. */
export async function ensureCompetitionEvent(competitionId: number, name: string, date: string): Promise<number> {
  const [row] = await db.insert(competitionEvents)
    .values({ competitionId, name, date })
    .onConflictDoUpdate({ target: [competitionEvents.competitionId, competitionEvents.name], set: { name: sql`excluded.name` } })
    .returning({ id: competitionEvents.id });
  return row.id;
}
