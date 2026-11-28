import { and, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { competitionEvents, competitions, countries, disciplines, shooters, teamResultMembers, teamResults } from "@shootermarkt/db/schema";
import type { ResultRowData } from "@/components/result-display/ResultsHistoryTable";
import { fullDisplayName } from "@/lib/shooter-mixed-results";

export type TeamHistoryInput = {
  id: number; teamName: string; rank: number | null; total: string | null; inners: number | null; remark: string | null;
  disciplineCode: string; category: string | null; competitionId: number; competitionName: string; competitionDate: string; competitionDateEnd: string | null;
  competitionLocation: string | null; competitionCountry: string | null; competitionCountryCode2: string | null;
  competitionEventId: number | null; eventName: string | null; eventDate: string | null;
  members: { shooterId: number | null; name: string; firstName?: string | null; lastName?: string | null; series: number[]; total: string; inners: number | null }[];
};

/** Ekipni nastup kao red istorije strelca: plasman i zbir su ekipni, članovi se vide u proširenom redu. */
export function toTeamHistoryRow(row: TeamHistoryInput): ResultRowData {
  return {
    id: row.id,
    rowKey: `t:${row.id}`,
    kind: "team",
    teamName: row.teamName,
    // imena kao kod miks tima: sa profila, a bez veze iz zapisa u biltenu
    teamMembers: row.members.map((m) => ({
      shooterId: m.shooterId, name: fullDisplayName(m.firstName ?? null, m.lastName ?? null, m.name) ?? m.name, series: m.series, total: Number(m.total), inners: m.inners,
    })),
    competitionId: row.competitionId,
    competitionName: row.competitionName,
    competitionDate: row.eventDate ?? row.competitionDate,
    competitionDateEnd: row.eventDate ? null : row.competitionDateEnd,
    competitionEventId: row.competitionEventId,
    eventName: row.eventName,
    competitionLocation: row.competitionLocation,
    competitionCountry: row.competitionCountry,
    competitionCountryCode2: row.competitionCountryCode2,
    disciplineCode: row.disciplineCode,
    category: row.category,
    qualTotal: row.total,
    qualRank: row.rank,
    qualInners: row.inners,
    qualRemark: row.remark,
    qualified: null,
    elimTotal: null,
    elimRank: null,
    elimRound: null,
    elimDetail: null,
    finalTotal: null,
    finalRank: null,
    qualDetail: null,
    finalDetail: null,
  };
}

export const teamForShooter = (shooterId: number) =>
  inArray(teamResults.id, db.select({ id: teamResultMembers.teamResultId }).from(teamResultMembers).where(eq(teamResultMembers.shooterId, shooterId)));

/** Klupske ekipe strelca kao redovi istorije (opciono samo za data takmičenja). */
export async function getShooterTeamRows(shooterId: number, competitionIds?: number[]): Promise<ResultRowData[]> {
  if (competitionIds && competitionIds.length === 0) return [];
  const rows = await db
    .select({
      id: teamResults.id, teamName: teamResults.teamName, rank: teamResults.rank, total: teamResults.total, inners: teamResults.inners, remark: teamResults.remark,
      disciplineCode: disciplines.code, category: teamResults.category,
      competitionId: competitions.id, competitionName: competitions.name, competitionDate: competitions.date, competitionDateEnd: competitions.dateEnd,
      competitionLocation: competitions.location, competitionCountry: countries.name, competitionCountryCode2: countries.code2,
      competitionEventId: teamResults.competitionEventId, eventName: competitionEvents.name, eventDate: competitionEvents.date,
    })
    .from(teamResults)
    .innerJoin(competitions, eq(teamResults.competitionId, competitions.id))
    .innerJoin(disciplines, eq(teamResults.disciplineId, disciplines.id))
    .leftJoin(countries, eq(competitions.countryId, countries.id))
    .leftJoin(competitionEvents, eq(teamResults.competitionEventId, competitionEvents.id))
    .where(and(teamForShooter(shooterId), competitionIds ? inArray(competitions.id, competitionIds) : undefined));
  if (!rows.length) return [];
  const members = await db.select({ ...getTableColumns(teamResultMembers), firstName: shooters.firstName, lastName: shooters.lastName })
    .from(teamResultMembers).leftJoin(shooters, eq(teamResultMembers.shooterId, shooters.id))
    .where(inArray(teamResultMembers.teamResultId, rows.map((r) => r.id))).orderBy(teamResultMembers.position);
  return rows.map((row) => toTeamHistoryRow({ ...row, members: members.filter((m) => m.teamResultId === row.id) }));
}
