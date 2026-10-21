import { and, eq, gt, gte, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { results, competitions, disciplines, shooterFormaCache } from "@shootermarkt/db/schema";
import { RANKING_MIN_SAMPLE, type CompetitionEventType, type CompetitionLevel, type ResultCategory } from "@/lib/forma";

/** qual_remark oznake koje znače da rezultat nije ispucan do kraja. */
export const INVALID_REMARKS = ["DNF", "DNS", "DSQ"];

export type RawFormaEntry = {
  qualTotal: number;
  date: string;
  level: CompetitionLevel | null;
  eventType: CompetitionEventType;
  category: ResultCategory;
};

export type FormaEntryGroup = {
  shooterId: number;
  disciplineCode: string;
  entries: RawFormaEntry[];
};

/** Koliko dana bez nastupa u disciplini strelac sme da bude da bi ostao u rang listi. */
export const RANKING_ACTIVE_DAYS = 365;

/** Cache rows eligible for the public forma ranking: dovoljno nastupa i aktivan u disciplini. */
export function rankedFormaCacheFilter() {
  return and(
    isNotNull(shooterFormaCache.forma),
    gte(shooterFormaCache.sampleSize, RANKING_MIN_SAMPLE),
    sql`exists (
      select 1 from ${results}
      join ${competitions} on ${competitions.id} = ${results.competitionId}
      join ${disciplines} on ${disciplines.id} = ${results.disciplineId}
      where ${results.shooterId} = ${shooterFormaCache.shooterId}
        and ${disciplines.code}::text = ${shooterFormaCache.disciplineCode}
        and ${results.qualTotal} > 0
        and ${competitions.date} >= to_char(current_date - ${RANKING_ACTIVE_DAYS}::int, 'YYYY-MM-DD')
    )`,
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
      eventType: competitions.eventType,
      category: results.category,
      disciplineCode: disciplines.code,
    })
    .from(results)
    .innerJoin(competitions, eq(results.competitionId, competitions.id))
    .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
    .where(
      and(
        shooterIds && shooterIds.length > 0 ? inArray(results.shooterId, shooterIds) : undefined,
        gt(results.qualTotal, "0"),
        // DNF/DNS/DSQ: delimičan ili nepostojeći skor — nije nastup za formu
        or(isNull(results.qualRemark), notInArray(results.qualRemark, INVALID_REMARKS)),
      )
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
      eventType: r.eventType,
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
