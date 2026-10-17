// Jednokratni uvoz ISSF kalendara (svetski kup, finale SK, SP, EP) za prošlu i tekuću godinu.
// Dry-run po defaultu; upis tek sa --commit.  Pokretanje: pnpm db:import-issf [-- --commit]
import { inArray } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitions, countries } from "@shootermarkt/db/schema";
import { detectCompetitionLevel, isRiflePistolCompetition } from "@shootermarkt/adapters/issf/competition-level";
import { fetchIssfEvents } from "@/lib/calendar/adapters";
import { groupsFromName } from "@/lib/competition-filters";

// ISSF tipovi: 1 Svetski kup, 2 Finale SK, 3 Svetsko prvenstvo, 5 Evropsko prvenstvo
const TYPE_IDS = new Set([1, 2, 3, 5]);
const YEAR = new Date().getFullYear();
const commit = process.argv.includes("--commit");

async function main() {
  const batches = await Promise.all([YEAR - 1, YEAR].map(async (y) => {
    const ev = await fetchIssfEvents(y);
    console.log(`${y}: ISSF vratio ${ev.length} događaja`);
    return ev;
  }));
  const events = batches.flat()
    .filter((e) => e.externalId && e.dateFrom && e.competitionTypeId != null && TYPE_IDS.has(e.competitionTypeId))
    .filter((e) => isRiflePistolCompetition(undefined, e.name))
    .sort((a, b) => a.dateFrom!.localeCompare(b.dateFrom!));
  console.log(`Posle filtera (tip + puška/pištolj): ${events.length}`);

  const existing = new Set(
    (await db.select({ id: competitions.issfId }).from(competitions)
      .where(inArray(competitions.issfId, events.map((e) => e.externalId!)))).map((r) => r.id),
  );

  const countryIds = new Map<string, number>();
  for (const c of await db.select().from(countries)) {
    for (const v of [c.code, c.code2, c.nocCode, c.name]) if (v) countryIds.set(v.trim().toLowerCase(), c.id);
  }

  const rows = [];
  for (const e of events) {
    const level = detectCompetitionLevel(e.competitionTypeId);
    const isNew = !existing.has(e.externalId!);
    console.log(`${isNew ? "NOVO " : "postoji"}  ${e.dateFrom}  ${(level ?? "NO-LEVEL").padEnd(11)} [${e.competitionTypeAcronym}] ${e.name}`);
    if (!isNew || !level) continue;
    rows.push({
      name: e.name,
      date: e.dateFrom!,
      dateEnd: e.dateTo && e.dateTo !== e.dateFrom ? e.dateTo : null,
      location: e.location,
      countryId: countryIds.get(e.country?.trim().toLowerCase() ?? "") ?? null,
      level,
      organizer: "ISSF",
      externalId: `issf:${e.externalId}`,
      issfId: e.externalId!,
      tags: ["issf"],
      disciplineGroups: groupsFromName(e.name),
    });
  }

  console.log(`\nZa upis: ${rows.length} (preskočeno postojećih: ${existing.size})`);
  if (!commit) return console.log("Dry-run. Dodaj --commit za upis.");
  if (!rows.length) return;
  const res = await db.insert(competitions).values(rows)
    .onConflictDoNothing({ target: competitions.issfId })
    .returning({ id: competitions.id });
  console.log(`Upisano: ${res.length}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
