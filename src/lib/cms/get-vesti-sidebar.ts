import { db } from "@/lib/db";
import { competitions, results, shooters, disciplines } from "@/lib/db/schema";
import { eq, gte, asc, and, isNotNull, inArray, desc, sql } from "drizzle-orm";
import { MVP_APPARATUS } from "@/lib/mvp-scope";

export interface UpcomingCompetition {
  id: number;
  name: string;
  nameSr: string | null;
  date: string;
  dateEnd: string | null;
  location: string | null;
  level: string;
}

export interface TopShooterRow {
  shooterId: number;
  firstName: string;
  lastName: string;
  discCode: string;
  discName: string;
  bestScore: number;
}

export async function getUpcomingCompetitions(limit = 5): Promise<UpcomingCompetition[]> {
  const today = new Date().toISOString().split("T")[0];
  return db
    .select({
      id: competitions.id,
      name: competitions.name,
      nameSr: competitions.nameSr,
      date: competitions.date,
      dateEnd: competitions.dateEnd,
      location: competitions.location,
      level: competitions.level,
    })
    .from(competitions)
    .where(gte(competitions.date, today))
    .orderBy(asc(competitions.date))
    .limit(limit);
}

// Top 3 shooters per MVP discipline by best qual_total in the last 12 months.
export async function getTopShootersByDiscipline(): Promise<Record<string, TopShooterRow[]>> {
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const rows = await db
    .select({
      shooterId: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      discCode: disciplines.code,
      discName: disciplines.name,
      bestScore: sql<number>`MAX(${results.qualTotal})`,
    })
    .from(results)
    .innerJoin(shooters, eq(results.shooterId, shooters.id))
    .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
    .innerJoin(competitions, eq(results.competitionId, competitions.id))
    .where(
      and(
        inArray(shooters.apparatus, [...MVP_APPARATUS]),
        gte(competitions.date, oneYearAgo),
        isNotNull(results.qualTotal),
      ),
    )
    .groupBy(
      shooters.id,
      shooters.firstName,
      shooters.lastName,
      disciplines.code,
      disciplines.name,
    )
    .orderBy(disciplines.code, desc(sql`MAX(${results.qualTotal})`));

  const grouped: Record<string, TopShooterRow[]> = {};
  for (const row of rows) {
    if (!grouped[row.discCode]) grouped[row.discCode] = [];
    if (grouped[row.discCode].length < 3) grouped[row.discCode].push(row);
  }
  return grouped;
}
