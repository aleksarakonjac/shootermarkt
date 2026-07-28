import { inArray, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { shooterFormaCache } from "@shootermarkt/db/schema";
import { computeFormaFromEntries } from "@/lib/forma";
import { getFormaEntriesByDiscipline } from "@/lib/forma-query";
import {
  computeAvgOfTopN,
  computeRecentAvg,
  computeSeasonAvg,
  currentSeasonStartYear,
  seasonWindow,
  type MetricEntry,
} from "@/lib/ranking-metrics";

/**
 * Recomputes forma cache rows for given shooters (or all shooters if omitted).
 * Called after every result commit so pages can read pre-computed values.
 */
export async function recomputeFormaCache(shooterIds?: number[]): Promise<void> {
  if (shooterIds && shooterIds.length === 0) return;
  const groups = await getFormaEntriesByDiscipline(shooterIds);

  // A deleted result can remove a whole shooter/discipline group. Clear targeted
  // rows first so cache entries that no longer have source results cannot survive.
  if (shooterIds?.length) {
    await db.delete(shooterFormaCache).where(inArray(shooterFormaCache.shooterId, shooterIds));
  }

  const airSeasonYear = currentSeasonStartYear("vazdusna");
  const seasonWin = seasonWindow("vazdusna", airSeasonYear);
  const prevSeasonWin = seasonWindow("vazdusna", airSeasonYear - 1);

  for (const { shooterId, disciplineCode, entries } of groups.values()) {
    const f = computeFormaFromEntries(entries, { code: disciplineCode });
    const m = entries as MetricEntry[];

    const peakCareer = m.length > 0 ? Math.max(...m.map((e) => e.qualTotal)) : null;
    const best3Career = computeAvgOfTopN(m, 3);
    const recent3Career = computeRecentAvg(m, 3);
    const { avg: seasonAvg, count: seasonCount } = computeSeasonAvg(m, seasonWin);
    const { avg: prevSeasonAvg } = computeSeasonAvg(m, prevSeasonWin);
    const improvement =
      seasonAvg != null && prevSeasonAvg != null
        ? Math.round((seasonAvg - prevSeasonAvg) * 10) / 10
        : null;

    const values = {
      shooterId,
      disciplineCode,
      forma: f.forma != null ? String(f.forma) : null,
      level: f.level != null ? String(f.level) : null,
      reliability: f.reliability != null ? String(f.reliability) : null,
      trend: f.trend ?? null,
      momentum: f.momentum != null ? String(f.momentum) : null,
      peak: f.peak != null ? String(f.peak) : null,
      peakProximity: f.peakProximity != null ? String(f.peakProximity) : null,
      consistency: f.consistency != null ? String(f.consistency) : null,
      sampleSize: f.sampleSize,
      lowConfidence: f.lowConfidence,
      peakCareer: peakCareer != null ? String(peakCareer) : null,
      best3Career: best3Career != null ? String(Math.round(best3Career * 10) / 10) : null,
      recent3Career: recent3Career != null ? String(Math.round(recent3Career * 10) / 10) : null,
      seasonAvg: seasonAvg != null ? String(Math.round(seasonAvg * 10) / 10) : null,
      prevSeasonAvg: prevSeasonAvg != null ? String(Math.round(prevSeasonAvg * 10) / 10) : null,
      improvement: improvement != null ? String(improvement) : null,
      seasonCount,
      careerCount: m.length,
      updatedAt: new Date(),
    };

    await db
      .insert(shooterFormaCache)
      .values(values)
      .onConflictDoUpdate({
        target: [shooterFormaCache.shooterId, shooterFormaCache.disciplineCode],
        set: {
          forma: sql`excluded.forma`,
          level: sql`excluded.level`,
          reliability: sql`excluded.reliability`,
          trend: sql`excluded.trend`,
          momentum: sql`excluded.momentum`,
          peak: sql`excluded.peak`,
          peakProximity: sql`excluded.peak_proximity`,
          consistency: sql`excluded.consistency`,
          sampleSize: sql`excluded.sample_size`,
          lowConfidence: sql`excluded.low_confidence`,
          peakCareer: sql`excluded.peak_career`,
          best3Career: sql`excluded.best3_career`,
          recent3Career: sql`excluded.recent3_career`,
          seasonAvg: sql`excluded.season_avg`,
          prevSeasonAvg: sql`excluded.prev_season_avg`,
          improvement: sql`excluded.improvement`,
          seasonCount: sql`excluded.season_count`,
          careerCount: sql`excluded.career_count`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
}
