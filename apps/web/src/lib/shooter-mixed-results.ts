import { and, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@shootermarkt/db";
import { competitions, countries, disciplines, mixedTeamResults, shooters } from "@shootermarkt/db/schema";
import { splitDisplayName } from "@shootermarkt/adapters/sius/public-adapter";
import type { ResultRowData } from "@/components/result-display/ResultsHistoryTable";

type SlotDetail = { series: number[]; total: number } | null;

export type MixedRowInput = {
  id: number;
  shooter1Id: number | null;
  shooter2Id: number | null;
  shooter1Name: string | null;
  shooter2Name: string | null;
  shooter1FirstName: string | null;
  shooter1LastName: string | null;
  shooter2FirstName: string | null;
  shooter2LastName: string | null;
  shooter1Detail: SlotDetail;
  shooter2Detail: SlotDetail;
  qualTotal: string | null;
  qualRank: number | null;
  qualified: boolean | null;
  finalTotal: string | null;
  finalRank: number | null;
  disciplineCode: string;
  category: string | null;
  competitionId: number;
  competitionName: string;
  competitionDate: string;
  competitionDateEnd: string | null;
  competitionLocation: string | null;
  competitionCountry: string | null;
  competitionCountryCode2: string | null;
};

const titleCase = (value: string) => value.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

/** "Ž. Petrović" iz povezanog strelca, inače iz SIUS imena "PETROVIĆ Žaklina". */
export function partnerShortName(firstName: string | null, lastName: string | null, displayName: string | null): string | null {
  if (firstName && lastName) return `${firstName[0]}. ${lastName}`;
  if (!displayName?.trim()) return null;
  const split = splitDisplayName(displayName);
  return split.firstName ? `${split.firstName[0]}. ${titleCase(split.lastName)}` : titleCase(split.lastName);
}

export function toMixedHistoryRow(row: MixedRowInput, shooterId: number): ResultRowData {
  const isFirst = row.shooter1Id === shooterId;
  return {
    id: row.id,
    rowKey: `m:${row.id}`,
    kind: "mixed",
    partnerName: isFirst
      ? partnerShortName(row.shooter2FirstName, row.shooter2LastName, row.shooter2Name)
      : partnerShortName(row.shooter1FirstName, row.shooter1LastName, row.shooter1Name),
    mixedDetail: { own: isFirst ? row.shooter1Detail : row.shooter2Detail, partner: isFirst ? row.shooter2Detail : row.shooter1Detail },
    competitionId: row.competitionId,
    competitionName: row.competitionName,
    competitionDate: row.competitionDate,
    competitionDateEnd: row.competitionDateEnd,
    competitionLocation: row.competitionLocation,
    competitionCountry: row.competitionCountry,
    competitionCountryCode2: row.competitionCountryCode2,
    disciplineCode: row.disciplineCode,
    category: row.category,
    qualTotal: row.qualTotal,
    qualRank: row.qualRank,
    qualInners: null,
    qualified: row.qualified,
    elimTotal: null,
    elimRank: null,
    elimRound: null,
    elimDetail: null,
    finalTotal: row.finalTotal,
    finalRank: row.finalRank,
    qualDetail: null,
    finalDetail: null,
  };
}

type CompetitionRef = { id: number; date: string };

/** Unija takmičenja iz pojedinačnih i mešovitih rezultata, `date desc, id desc`, `limit + 1` (za sledeći kursor). */
export function mergeCompetitionIds(a: CompetitionRef[], b: CompetitionRef[], limit: number): CompetitionRef[] {
  const byId = new Map([...a, ...b].map((c) => [c.id, c]));
  return [...byId.values()]
    .sort((x, y) => (x.date === y.date ? y.id - x.id : x.date < y.date ? 1 : -1))
    .slice(0, limit + 1);
}

const partner1 = alias(shooters, "partner1");
const partner2 = alias(shooters, "partner2");

export const mixedForShooter = (shooterId: number) =>
  or(eq(mixedTeamResults.shooter1Id, shooterId), eq(mixedTeamResults.shooter2Id, shooterId));

/** Mešoviti timovi strelca kao redovi istorije (opciono samo za data takmičenja). */
export async function getShooterMixedRows(shooterId: number, competitionIds?: number[]): Promise<ResultRowData[]> {
  if (competitionIds && competitionIds.length === 0) return [];
  const rows = await db
    .select({
      id: mixedTeamResults.id,
      shooter1Id: mixedTeamResults.shooter1Id,
      shooter2Id: mixedTeamResults.shooter2Id,
      shooter1Name: mixedTeamResults.shooter1Name,
      shooter2Name: mixedTeamResults.shooter2Name,
      shooter1FirstName: partner1.firstName,
      shooter1LastName: partner1.lastName,
      shooter2FirstName: partner2.firstName,
      shooter2LastName: partner2.lastName,
      shooter1Detail: mixedTeamResults.shooter1Detail,
      shooter2Detail: mixedTeamResults.shooter2Detail,
      qualTotal: mixedTeamResults.qualTotal,
      qualRank: mixedTeamResults.qualRank,
      qualified: mixedTeamResults.qualified,
      finalTotal: mixedTeamResults.finalTotal,
      finalRank: mixedTeamResults.finalRank,
      disciplineCode: disciplines.code,
      category: mixedTeamResults.category,
      competitionId: competitions.id,
      competitionName: competitions.name,
      competitionDate: competitions.date,
      competitionDateEnd: competitions.dateEnd,
      competitionLocation: competitions.location,
      competitionCountry: countries.name,
      competitionCountryCode2: countries.code2,
    })
    .from(mixedTeamResults)
    .innerJoin(competitions, eq(mixedTeamResults.competitionId, competitions.id))
    .innerJoin(disciplines, eq(mixedTeamResults.disciplineId, disciplines.id))
    .leftJoin(countries, eq(competitions.countryId, countries.id))
    .leftJoin(partner1, eq(mixedTeamResults.shooter1Id, partner1.id))
    .leftJoin(partner2, eq(mixedTeamResults.shooter2Id, partner2.id))
    .where(and(mixedForShooter(shooterId), competitionIds ? inArray(competitions.id, competitionIds) : undefined));
  return rows.map((row) => toMixedHistoryRow(row as MixedRowInput, shooterId));
}
