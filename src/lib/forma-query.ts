import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { results, competitions, disciplines, shooterFormaCache } from "@/lib/db/schema";
import { RANKING_MIN_SAMPLE, type CompetitionLevel, type ResultCategory } from "@/lib/forma";

export type RawFormaEntry = {
  qualTotal: number;
  date: string;
  level: CompetitionLevel | null;
  category: ResultCategory;
};

export type FormaEntryGroup = {
  shooterId: number;
  disciplineCode: string;
  entries: RawFormaEntry[];
};

/** Cache rows eligible for the public forma ranking. */
export function rankedFormaCacheFilter() {
  return and(
    isNotNull(shooterFormaCache.forma),
    gte(shooterFormaCache.sampleSize, RANKING_MIN_SAMPLE),
  );
}

/**
 * Fetches every qualified result for the given shooters (all shooters when omitted),
 * grouped by (shooterId, disciplineCode) — the shape computeFormaFromEntries expects.
 * The one seam between the `results` table and forma.ts; every caller that needs
 * a shooter's forma entries goes through this instead of re-joining+grouping itself.
 */
export async function getFormaEntriesByDiscipline(
  shooterIds?: number[]
): Promise<Map<string, FormaEntryGroup>> {
  const rows = await db
    .select({
      shooterId: results.shooterId,
      qualTotal: results.qualTotal,
      date: competitions.date,
      level: competitions.level,
      category: results.category,
      disciplineCode: disciplines.code,
    })
    .from(results)
    .innerJoin(competitions, eq(results.competitionId, competitions.id))
    .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
    .where(
      shooterIds && shooterIds.length > 0
        ? and(inArray(results.shooterId, shooterIds), isNotNull(results.qualTotal))
        : isNotNull(results.qualTotal)
    );

  const groups = new Map<string, FormaEntryGroup>();
  for (const r of rows) {
    const key = `${r.shooterId}:${r.disciplineCode}`;
    if (!groups.has(key)) {
      groups.set(key, { shooterId: r.shooterId, disciplineCode: r.disciplineCode, entries: [] });
    }
    groups.get(key)!.entries.push({
      qualTotal: Number(r.qualTotal),
      date: r.date,
      level: r.level as CompetitionLevel | null,
      category: r.category as ResultCategory,
    });
  }
  return groups;
}

/** Convenience: every discipline group for a single shooter. */
export async function getFormaEntriesForShooter(shooterId: number): Promise<FormaEntryGroup[]> {
  const groups = await getFormaEntriesByDiscipline([shooterId]);
  return Array.from(groups.values());
}
