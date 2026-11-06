import { eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { mixedTeamResults, results, shooters } from "@shootermarkt/db/schema";
import { foldName, foldNameSql, matchShooter, normalizeNoc, NOC_ALIASES, type MatchCandidate } from "@shootermarkt/db/name-match";

export type RosterShooter = MatchCandidate & { issfId: string | null };

export type RosterQueries = {
  byNationalities: (nationalities: string[]) => Promise<RosterShooter[]>;
  byFoldedLastName: (foldedLastName: string) => Promise<RosterShooter[]>;
  byIssfId: (issfId: string) => Promise<RosterShooter | undefined>;
};

export type ShooterRoster = ReturnType<typeof createShooterRoster>;

/**
 * Poklapanje strelaca za live-fetch cron bez učitavanja cele tabele (~4 MB egress-a svakog minuta).
 * `known` pokriva skoro sve posle prvog minuta discipline; za ostale se dovlače svi kandidati
 * koje matchShooter može da prihvati: ista država ili isto prezime.
 */
export function createShooterRoster(known: RosterShooter[], queries: RosterQueries) {
  const nations = new Map<string, Promise<RosterShooter[]>>();

  const nationRows = (nation: string | null) => {
    if (!nation) return [];
    let rows = nations.get(nation);
    if (!rows) {
      const aliases = Object.keys(NOC_ALIASES).filter((alias) => NOC_ALIASES[alias] === nation);
      rows = queries.byNationalities([nation, ...aliases]);
      nations.set(nation, rows);
    }
    return rows;
  };

  const match = async (firstName: string, lastName: string, noc: string | null) => {
    const exact = matchShooter(firstName, lastName, noc, known, { exactOnly: true });
    if (exact.kind === "exact") return exact;
    const [sameNation, sameLastName] = await Promise.all([nationRows(normalizeNoc(noc)), queries.byFoldedLastName(foldName(lastName))]);
    // Bez duplikata: varijanta imena se auto-povezuje samo kad je kandidat jedinstven.
    const candidates = new Map([...known, ...sameNation, ...sameLastName].map((shooter) => [shooter.id, shooter]));
    return matchShooter(firstName, lastName, noc, [...candidates.values()]);
  };

  const matchIssf = async (issfId: string | null, firstName: string, lastName: string, noc: string | null) => {
    if (issfId) {
      const linked = known.find((shooter) => shooter.issfId === issfId) ?? await queries.byIssfId(issfId);
      if (linked) return linked.id;
    }
    const result = await match(firstName, lastName, noc);
    return result.kind === "exact" ? result.id : null;
  };

  return { match, matchIssf, add: (shooter: RosterShooter) => void known.push(shooter) };
}

const columns = {
  id: shooters.id,
  firstName: shooters.firstName,
  lastName: shooters.lastName,
  previousLastNames: shooters.previousLastNames,
  previousFirstNames: shooters.previousFirstNames,
  nationality: shooters.nationality,
  issfId: shooters.issfId,
};

/** Strelci već vezani za takmičenja i svi sa ranijim prezimenom (malo ih je, a prezime ih inače ne bi našlo). */
export async function loadShooterRoster(competitionIds: number[]) {
  const linked = db.select({ id: results.shooterId }).from(results).where(inArray(results.competitionId, competitionIds));
  const mixedLinked = db.select({ id: sql<number>`unnest(array[${mixedTeamResults.shooter1Id}, ${mixedTeamResults.shooter2Id}])` }).from(mixedTeamResults).where(inArray(mixedTeamResults.competitionId, competitionIds));
  const known = await db.select(columns).from(shooters).where(or(inArray(shooters.id, linked), inArray(shooters.id, mixedLinked), isNotNull(shooters.previousLastNames)));
  return createShooterRoster(known, {
    byNationalities: (nationalities) => db.select(columns).from(shooters).where(inArray(shooters.nationality, nationalities)),
    byFoldedLastName: (foldedLastName) => db.select(columns).from(shooters).where(eq(foldNameSql(shooters.lastName), foldedLastName)),
    byIssfId: async (issfId) => (await db.select(columns).from(shooters).where(eq(shooters.issfId, issfId)).limit(1))[0],
  });
}
