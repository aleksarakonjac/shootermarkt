/** Povezivanje članova klupskih i mešovitih timova sa strelcima iz baze, za pregled PDF uvoza (bez baze). */
import { matchShooter, nameKey, type MatchCandidate } from "@shootermarkt/db/name-match";
import type { MixedTeamEntry, ReviewRow, TeamResultEntry } from "@shootermarkt/db/pdf-import-types";

/** Isto pravilo kao za pojedinačne redove: tačan pogodak se vezuje, sličan zapis se samo predlaže. */
export function matchMember(m: { firstName: string; lastName: string; teamNoc: string }, shooters: MatchCandidate[]) {
  const match = matchShooter(m.firstName, m.lastName, m.teamNoc.toUpperCase(), shooters);
  if (match.kind === "exact") return { shooterId: match.id, isNew: false };
  if (match.kind === "suggestion") return { isNew: true, suggestedShooterId: match.id, suggestedName: match.name };
  return { isNew: true };
}

export function matchTeamMembers(teamResults: TeamResultEntry[], mixed: MixedTeamEntry[], rows: ReviewRow[], shooters: MatchCandidate[]) {
  const rowByName = new Map(rows.map((r) => [nameKey(r.firstName, r.lastName), r]));
  return {
    teamResults: teamResults.map((team) => ({
      ...team,
      members: team.members.map((m) => {
        // isti strelac na pojedinačnoj listi: njegova nacija važi i ovde, da pregled vidi jednog novog strelca
        const row = rowByName.get(nameKey(m.firstName, m.lastName));
        const own = row ? { ...m, teamNoc: row.teamNoc, nationAssumed: row.nationAssumed } : m;
        return { ...own, ...matchMember(own, shooters) };
      }),
    })),
    mixed: mixed.map((t) => {
      const [mNoc, fNoc = mNoc] = t.nocCode.split("/");
      const m = matchMember({ firstName: t.mFirstName, lastName: t.mLastName, teamNoc: mNoc }, shooters);
      const f = matchMember({ firstName: t.fFirstName, lastName: t.fLastName, teamNoc: fNoc }, shooters);
      return {
        ...t, createMissing: true,
        mShooterId: m.shooterId, mIsNew: m.isNew, mSuggestedShooterId: m.suggestedShooterId, mSuggestedName: m.suggestedName, mGender: "M" as const,
        fShooterId: f.shooterId, fIsNew: f.isNew, fSuggestedShooterId: f.suggestedShooterId, fSuggestedName: f.suggestedName, fGender: "F" as const,
      };
    }),
  };
}
