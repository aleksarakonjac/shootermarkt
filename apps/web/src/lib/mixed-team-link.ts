import { sql } from "drizzle-orm";
import { mixedTeamResults } from "@shootermarkt/db/schema";
import { asIssfId, foldNameSql, matchAthlete, normalizeNoc, type AgeContext, type MatchCandidate } from "@shootermarkt/db/name-match";
import type { MixedCommitEntry } from "@/lib/import-commit-mixed";

/**
 * shooterN_id pri ponovnom upisu reda tima. Redni broj tima nije stalan (prati plasman), pa isti red može dobiti
 * drugog strelca: stara veza važi samo dok je ime na tom mestu isto, inače se uzima nova (i kad je prazna).
 * `prefer` bira pobednika za isto ime: uvoz čuva postojeću (ručno povezivanje, cron), cron uzima novu ako je ima.
 */
export function teamLinkOnConflict(slot: 1 | 2, prefer: "stored" | "incoming") {
  const id = slot === 1 ? mixedTeamResults.shooter1Id : mixedTeamResults.shooter2Id;
  const name = slot === 1 ? mixedTeamResults.shooter1Name : mixedTeamResults.shooter2Name;
  const newId = sql.raw(`excluded.shooter${slot}_id`);
  const newName = sql.raw(`excluded.shooter${slot}_name`);
  const same = prefer === "stored" ? sql`coalesce(${id}, ${newId})` : sql`coalesce(${newId}, ${id})`;
  // bez imena na jednoj strani poređenje je null → važi kao isto ime
  return sql`case when ${foldNameSql(name)} <> ${foldNameSql(newName)} then ${newId} else ${same} end`;
}

/**
 * Članovi tima → strelci iz baze, samo za siguran pogodak: isti ISSF ID, inače tačno ime (bez varijanti) i ista država.
 * Strožije od pojedinačnih (matchShooter pušta SRB/AIN i strelce bez države): veza koju upis napravi
 * ostaje dok se ime ne promeni, pa pogrešna preživljava ponovni uvoz.
 */
export function linkTeamMembers(entry: Pick<MixedCommitEntry, "m_firstName" | "m_lastName" | "mIssfId" | "f_firstName" | "f_lastName" | "fIssfId">, nocCode: string, shooters: MatchCandidate[], age?: AgeContext) {
  const link = (id?: string | null, first?: string, last?: string) => {
    const issfId = asIssfId(id);
    const linked = issfId && shooters.find((s) => s.issfId === issfId);
    if (linked) return linked.id;
    if (!first?.trim() || !last?.trim()) return null;
    const nation = normalizeNoc(nocCode);
    const sameNation = shooters.filter((s) => s.nationality && normalizeNoc(s.nationality) === nation);
    const match = matchAthlete(issfId, first, last, nocCode, sameNation, { exactOnly: true, age });
    return match.kind === "exact" ? match.id : null;
  };
  return {
    shooter1Id: link(entry.mIssfId, entry.m_firstName, entry.m_lastName),
    shooter2Id: link(entry.fIssfId, entry.f_firstName, entry.f_lastName),
  };
}
