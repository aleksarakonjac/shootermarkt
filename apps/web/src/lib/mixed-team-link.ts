import { asIssfId, matchAthlete, normalizeNoc, type AgeContext, type MatchCandidate } from "@shootermarkt/db/name-match";
import type { MixedCommitEntry } from "@/lib/import-commit-mixed";

/**
 * Članovi tima → strelci iz baze, samo za siguran pogodak: isti ISSF ID, inače tačno ime (bez varijanti) i ista država.
 * Strožije od pojedinačnih (matchShooter pušta SRB/AIN i strelce bez države): veza koju upis napravi
 * ponovni uvoz ne briše, pa pogrešna ostaje.
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
