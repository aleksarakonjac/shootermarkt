import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { shooters, results, competitions, disciplines } from "@/lib/db/schema";
import { computeFormaScore, type FormaResult } from "@/lib/forma-score";

export interface ShooterCardData {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  nationality: string | null;
  clubName: string | null;
  forma: FormaResult | null;
}

export async function resolveShooter(id: number): Promise<ShooterCardData | null> {
  const shooter = await db.query.shooters.findFirst({
    where: eq(shooters.id, id),
    with: { club: true },
  });
  if (!shooter) return null;

  const rows = await db
    .select({
      qualTotal: results.qualTotal,
      competitionDate: competitions.date,
      disciplineId: disciplines.id,
      maxQualScore: disciplines.maxQualScore,
    })
    .from(results)
    .innerJoin(competitions, eq(results.competitionId, competitions.id))
    .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
    .where(eq(results.shooterId, id));

  let forma: FormaResult | null = null;
  if (rows.length > 0) {
    // Group by discipline, use whichever discipline has the most results
    // as the "primary" one shown on the embed card.
    const byDiscipline = new Map<number, typeof rows>();
    for (const r of rows) {
      if (r.qualTotal == null) continue;
      const list = byDiscipline.get(r.disciplineId) ?? [];
      list.push(r);
      byDiscipline.set(r.disciplineId, list);
    }
    let bestDisciplineRows: typeof rows = [];
    for (const list of byDiscipline.values()) {
      if (list.length > bestDisciplineRows.length) bestDisciplineRows = list;
    }
    if (bestDisciplineRows.length > 0) {
      forma = computeFormaScore(
        bestDisciplineRows.map((r) => ({
          qualTotal: parseFloat(r.qualTotal!),
          date: r.competitionDate,
        })),
        parseFloat(bestDisciplineRows[0].maxQualScore)
      );
    }
  }

  return {
    id: shooter.id,
    firstName: shooter.firstName,
    lastName: shooter.lastName,
    avatarUrl: shooter.avatarUrl,
    nationality: shooter.nationality,
    clubName: shooter.club?.name ?? null,
    forma,
  };
}
