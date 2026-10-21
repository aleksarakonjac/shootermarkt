// Jednokratno: popuni competitions.event_type iz naziva za takmičenja koja su još "other".
// Ručno postavljen tip se ne dira. Dry-run po defaultu; upis tek sa --commit.
//   pnpm db:tag-event-types [-- --commit]
import { eq } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { eventTypeFromName } from "@/lib/competition-filters";

const commit = process.argv.includes("--commit");

async function main() {
  const rows = await db
    .select({ id: competitions.id, name: competitions.name, level: competitions.level })
    .from(competitions)
    .where(eq(competitions.eventType, "other"));

  const changes = rows
    .map((c) => ({ ...c, eventType: eventTypeFromName(c.name) }))
    .filter((c) => c.eventType !== "other");

  for (const c of changes) console.log(`[${c.id}] ${c.level.padEnd(13)} ${c.eventType.padEnd(16)} ${c.name}`);
  console.log(`\n${changes.length} od ${rows.length} "other" takmičenja dobija tip; ${rows.length - changes.length} ostaje "other" (ručno).`);
  if (!commit) return console.log("Dry-run. Dodaj --commit za upis.");

  for (const c of changes) {
    await db.update(competitions).set({ eventType: c.eventType }).where(eq(competitions.id, c.id));
  }
  console.log(`Upisano: ${changes.length}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
