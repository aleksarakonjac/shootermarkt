import { eq } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitions, disciplines, mixedTeamResults, results } from "@shootermarkt/db/schema";
import { groupsFromDistances } from "@/lib/competition-filters";

/**
 * Postavlja competitions.discipline_groups iz stvarnih rezultata (disciplines.distance).
 * Ako takmičenje još nema rezultate, vrednost se ne dira (ostaje procena iz naziva ili ručni unos).
 */
export async function refreshDisciplineGroups(competitionId: number) {
  const [individual, mixed] = await Promise.all([
    db.selectDistinct({ distance: disciplines.distance }).from(results)
      .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .where(eq(results.competitionId, competitionId)),
    db.selectDistinct({ distance: disciplines.distance }).from(mixedTeamResults)
      .innerJoin(disciplines, eq(mixedTeamResults.disciplineId, disciplines.id))
      .where(eq(mixedTeamResults.competitionId, competitionId)),
  ]);
  const groups = groupsFromDistances([...individual, ...mixed].map((row) => row.distance));
  if (groups.length === 0) return;
  await db.update(competitions).set({ disciplineGroups: groups }).where(eq(competitions.id, competitionId));
}
