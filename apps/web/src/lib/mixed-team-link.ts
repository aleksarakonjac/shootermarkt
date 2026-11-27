import { matchShooter, normalizeNoc, type MatchCandidate } from "@shootermarkt/db/name-match";
import type { MixedCommitEntry } from "@/lib/import-commit-mixed";

/**
 * Članovi tima → strelci iz baze, samo za siguran pogodak: tačno ime (bez varijanti) i ista država.
 * Strožije od pojedinačnih (matchShooter pušta SRB/AIN i strelce bez države): veza koju upis napravi
 * ponovni uvoz ne briše, pa pogrešna ostaje.
 */
export function linkTeamMembers(entry: Pick<MixedCommitEntry, "m_firstName" | "m_lastName" | "f_firstName" | "f_lastName">, nocCode: string, shooters: MatchCandidate[]) {
  const link = (first?: string, last?: string) => {
    if (!first?.trim() || !last?.trim()) return null;
    const nation = normalizeNoc(nocCode);
    const sameNation = shooters.filter((s) => s.nationality && normalizeNoc(s.nationality) === nation);
    const match = matchShooter(first, last, nocCode, sameNation, { exactOnly: true });
    return match.kind === "exact" ? match.id : null;
  };
  return { shooter1Id: link(entry.m_firstName, entry.m_lastName), shooter2Id: link(entry.f_firstName, entry.f_lastName) };
}
