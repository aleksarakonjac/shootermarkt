"use server";

import { db } from "@/lib/db";
import { shooters, clubs, results } from "@/lib/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { computeFormaFromEntries } from "@/lib/forma";
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

export async function getVerifiedShooters() {
  const list = await db
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      clubName: clubs.name,
      nationality: shooters.nationality,
    })
    .from(shooters)
    .leftJoin(clubs, eq(shooters.clubId, clubs.id))
    .where(eq(shooters.verified, true))
    .orderBy(shooters.lastName, shooters.firstName);

  return list;
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
      .where(and(
        sql`${results.shooterId} IN (${idA}, ${idB})`,
        isNotNull(results.qualTotal)
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
