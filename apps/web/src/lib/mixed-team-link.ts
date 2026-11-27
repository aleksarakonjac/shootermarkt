import { matchShooter, type MatchCandidate } from "@shootermarkt/db/name-match";
import type { MixedCommitEntry } from "@/lib/import-commit-mixed";

/** Članovi tima → strelci iz baze, samo za siguran pogodak (isto ime i država). Nesigurni ostaju samo kao ime. */
export function linkTeamMembers(entry: Pick<MixedCommitEntry, "m_firstName" | "m_lastName" | "f_firstName" | "f_lastName">, nocCode: string, shooters: MatchCandidate[]) {
  const link = (first?: string, last?: string) => {
    if (!first?.trim() || !last?.trim()) return null;
    const match = matchShooter(first, last, nocCode, shooters);
    return match.kind === "exact" ? match.id : null;
  };
  return { shooter1Id: link(entry.m_firstName, entry.m_lastName), shooter2Id: link(entry.f_firstName, entry.f_lastName) };
}
