"use server";

import { db } from "@shootermarkt/db";
import { shooters, results, disciplines } from "@shootermarkt/db/schema";
import { ESC_SOLO_CODES } from "@shootermarkt/db/pdf-import-types";
import { eq, and, isNotNull, notInArray, sql } from "drizzle-orm";
import { computeFormaFromEntries, rollingForma } from "@/lib/forma";
import { getFormaEntriesForShooter } from "@/lib/forma-query";

export interface ShooterCompareStats {
  id: number;
  firstName: string;
  lastName: string;
  nationality: string | null;
  clubName: string | null;
  avatarUrl: string | null;
  disciplines: {
    [code: string]: {
      peak: number;
      forma: number | null;
      matchesCount: number;
    };
  };
}

export interface ComparisonResult {
  shooterA: ShooterCompareStats | null;
  shooterB: ShooterCompareStats | null;
  h2hRecord: {
    winsA: number;
    winsB: number;
    draws: number;
    total: number;
  };
}

export async function compareShooters(idA: number, idB: number): Promise<ComparisonResult> {
  const fetchShooterStats = async (id: number): Promise<ShooterCompareStats | null> => {
    const s = await db.query.shooters.findFirst({
      where: eq(shooters.id, id),
      with: { club: true },
    });

    if (!s) return null;

    const entryGroups = await getFormaEntriesForShooter(id);

    const disciplinesStats: ShooterCompareStats["disciplines"] = {};
    for (const { disciplineCode, entries } of entryGroups) {
      const peak = Math.max(...entries.map((e) => e.qualTotal));
      const forma = computeFormaFromEntries(entries, { code: disciplineCode });

      disciplinesStats[disciplineCode] = {
        peak,
        forma: forma.forma,
        matchesCount: entries.length,
      };
    }

    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      nationality: s.nationality,
      clubName: s.club ? s.club.name : null,
      avatarUrl: s.avatarUrl,
      disciplines: disciplinesStats,
    };
  };

  const [shooterA, shooterB] = await Promise.all([
    fetchShooterStats(idA),
    fetchShooterStats(idB),
  ]);

  // Compute H2H record (mutual matches)
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let total = 0;

  if (shooterA && shooterB) {
    // Find all competitions where both shot in the same discipline
    const mutualResults = await db
      .select({
        compId: results.competitionId,
        discId: results.disciplineId,
        scoreA: sql`MAX(CASE WHEN ${results.shooterId} = ${idA} THEN ${results.qualTotal} END)`,
        scoreB: sql`MAX(CASE WHEN ${results.shooterId} = ${idB} THEN ${results.qualTotal} END)`,
      })
      .from(results)
      .innerJoin(disciplines, eq(disciplines.id, results.disciplineId))
      .where(and(
        sql`${results.shooterId} IN (${idA}, ${idB})`,
        isNotNull(results.qualTotal),
        // ESC Solo: K1 i K2 pogoci nisu uporedivi skorovi
        notInArray(disciplines.code, [...ESC_SOLO_CODES])
      ))
      .groupBy(results.competitionId, results.disciplineId);

    for (const mr of mutualResults) {
      const sA = mr.scoreA ? parseFloat(mr.scoreA as string) : null;
      const sB = mr.scoreB ? parseFloat(mr.scoreB as string) : null;

      if (sA !== null && sB !== null) {
        total++;
        if (sA > sB) winsA++;
        else if (sB > sA) winsB++;
        else draws++;
      }
    }
  }

  return {
    shooterA,
    shooterB,
    h2hRecord: { winsA, winsB, draws, total },
  };
}


export type FormaHistoryPoint = { date: string; score: number; forma: number; name: string | null; location: string | null };

/** Poslednjih `limit` nastupa strelca u disciplini sa rolling formom na svakom — za grafik u detail sheet-u. */
export async function getFormaHistory(shooterId: number, disciplineCode: string, locale: string, limit = 10): Promise<FormaHistoryPoint[]> {
  if (!Number.isInteger(shooterId) || !/^[A-Z0-9]{2,10}$/.test(disciplineCode)) return [];
  const group = (await getFormaEntriesForShooter(shooterId)).find((g) => g.disciplineCode === disciplineCode);
  if (!group) return [];
  const entries = [...group.entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ score: e.qualTotal, date: e.date, level: e.level, eventType: e.eventType, category: e.category, competition: e.competition }));
  const rolling = rollingForma(entries, { code: disciplineCode });
  const en = locale === "en";
  return entries.map((e, i) => ({
    date: e.date, score: e.score, forma: rolling[i].forma,
    name: (en ? e.competition?.nameEn : e.competition?.nameSr) ?? e.competition?.name ?? null,
    location: (en ? e.competition?.locationEn : e.competition?.locationSr) ?? e.competition?.location ?? null,
  })).slice(-limit);
}
