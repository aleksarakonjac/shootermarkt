import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitionEvents, competitionSchedule, disciplines, results } from "@shootermarkt/db/schema";
import { recomputeFormaCache } from "@/lib/forma-cache";
import { refreshDisciplineGroups } from "@/lib/discipline-groups";

// Briše RFPM rezultate i termine; red u `disciplines` i enum ostaju (standby do implementacije pravila).
// Dry-run je podrazumevan: `pnpm db:remove-rfpm` ispiše, `pnpm db:remove-rfpm --apply` briše.
const apply = process.argv.includes("--apply");

async function main() {
  const [rfpm] = await db.select({ id: disciplines.id }).from(disciplines).where(eq(disciplines.code, "RFPM"));
  if (!rfpm) {
    console.log("Disciplina RFPM ne postoji u bazi, nema šta da se briše.");
    return;
  }

  const rfpmResults = await db
    .select({ id: results.id, competitionId: results.competitionId, shooterId: results.shooterId, eventId: results.competitionEventId })
    .from(results)
    .where(eq(results.disciplineId, rfpm.id));
  const slots = await db
    .select({ id: competitionSchedule.id, competitionId: competitionSchedule.competitionId })
    .from(competitionSchedule)
    .where(eq(competitionSchedule.disciplineId, rfpm.id));

  const resultIds = new Set(rfpmResults.map((r) => r.id));
  const eventIds = [...new Set(rfpmResults.map((r) => r.eventId).filter((id): id is number => id != null))];
  // Event ostaje bez rezultata ako nijedan njegov rezultat nije RFPM-ov koji se briše.
  const orphanEvents = eventIds.length
    ? await db
        .select({ id: competitionEvents.id, competitionId: competitionEvents.competitionId })
        .from(competitionEvents)
        .where(
          and(
            inArray(competitionEvents.id, eventIds),
            notExists(
              db.select({ one: sql`1` }).from(results).where(
                and(eq(results.competitionEventId, competitionEvents.id), sql`${results.id} not in (${sql.join([...resultIds].map((id) => sql`${id}`), sql`, `)})`)
              )
            )
          )
        )
    : [];

  const perComp = new Map<number, { results: number; slots: number; events: number }>();
  const bump = (id: number, key: "results" | "slots" | "events") => {
    const row = perComp.get(id) ?? { results: 0, slots: 0, events: 0 };
    row[key]++;
    perComp.set(id, row);
  };
  rfpmResults.forEach((r) => bump(r.competitionId, "results"));
  slots.forEach((s) => bump(s.competitionId, "slots"));
  orphanEvents.forEach((e) => bump(e.competitionId, "events"));

  console.log(`${apply ? "APPLY" : "DRY-RUN"} — RFPM (discipline id ${rfpm.id})`);
  console.table(Object.fromEntries([...perComp].map(([id, c]) => [`takmičenje ${id}`, c])));
  console.log(`Ukupno: ${rfpmResults.length} rezultata, ${slots.length} termina, ${orphanEvents.length} praznih eventa.`);

  if (!apply) {
    console.log("Ništa nije obrisano. Pokreni sa --apply (prethodno Supabase backup).");
    return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(results).where(eq(results.disciplineId, rfpm.id));
    await tx.delete(competitionSchedule).where(eq(competitionSchedule.disciplineId, rfpm.id));
    if (orphanEvents.length) {
      await tx.delete(competitionEvents).where(inArray(competitionEvents.id, orphanEvents.map((e) => e.id)));
    }
  });
  console.log("Obrisano.");

  await recomputeFormaCache([...new Set(rfpmResults.map((r) => r.shooterId))]);
  for (const id of perComp.keys()) await refreshDisciplineGroups(id);
  console.log("Forma keš i discipline_groups osveženi.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
