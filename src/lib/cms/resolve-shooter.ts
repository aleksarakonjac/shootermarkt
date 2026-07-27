import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { shooters } from "@/lib/db/schema";
import { computeFormaFromEntries, type FormaResult } from "@/lib/forma";
import { getFormaEntriesForShooter } from "@/lib/forma-query";

export interface ShooterCardData {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  nationality: string | null;
  clubName: string | null;
  disciplineCode: string | null;
  forma: FormaResult | null;
}

export async function resolveShooter(id: number): Promise<ShooterCardData | null> {
  const shooter = await db.query.shooters.findFirst({
    where: eq(shooters.id, id),
    with: { club: true },
  });
  if (!shooter) return null;

  const entryGroups = await getFormaEntriesForShooter(id);

  // Use whichever discipline has the most results as the "primary" one shown on the embed card.
  let bestGroup = entryGroups[0] ?? null;
  for (const group of entryGroups) {
    if (group.entries.length > (bestGroup?.entries.length ?? 0)) bestGroup = group;
  }

  const disciplineCode = bestGroup?.disciplineCode ?? null;
  const forma: FormaResult | null = bestGroup
    ? computeFormaFromEntries(bestGroup.entries, { code: bestGroup.disciplineCode })
    : null;

  return {
    id: shooter.id,
    firstName: shooter.firstName,
    lastName: shooter.lastName,
    avatarUrl: shooter.avatarUrl,
    nationality: shooter.nationality,
    clubName: shooter.club?.name ?? null,
    disciplineCode,
    forma,
  };
}
