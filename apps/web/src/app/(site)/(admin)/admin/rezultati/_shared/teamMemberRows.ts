// Novi strelci iz timova prolaze kroz isti panel kao novi iz pojedinačnih lista: član tima kao "red" za pregled.
import { DISCIPLINE_META, numberTeams, type MixedTeamEntry, type ReviewRow, type TeamResultEntry } from "@shootermarkt/db/pdf-import-types";

/** Jedan red po članu svake nepreskočene ekipe: prvo klupske, pa mešoviti (muški, ženski). */
export function memberRows(teamResults: TeamResultEntry[], mixed: MixedTeamEntry[]): ReviewRow[] {
  const club = teamResults.filter((t) => !t.skip).flatMap((t) => t.members.map((m): ReviewRow => ({
    firstName: m.firstName, lastName: m.lastName, teamNoc: m.teamNoc, nationAssumed: m.nationAssumed,
    isNew: m.isNew, shooterId: m.shooterId, suggestedShooterId: m.suggestedShooterId, suggestedName: m.suggestedName,
    gender: DISCIPLINE_META[t.disciplineCode].gender ?? undefined, apparatus: DISCIPLINE_META[t.disciplineCode].apparatus,
    disciplineCode: t.disciplineCode, category: t.category, clubAbbr: t.teamName, qualTotal: m.total,
  })));
  const pairs = mixed.filter((t) => !t.skip).flatMap((t) => {
    const [mNoc, fNoc = mNoc] = t.nocCode.split("/");
    const base = { disciplineCode: t.disciplineCode, category: t.category ?? "senior" as const, apparatus: DISCIPLINE_META[t.disciplineCode].apparatus, nationAssumed: t.nationAssumed, clubAbbr: t.clubName };
    return [
      { ...base, firstName: t.mFirstName, lastName: t.mLastName, teamNoc: mNoc, isNew: t.mIsNew, shooterId: t.mShooterId, suggestedShooterId: t.mSuggestedShooterId, suggestedName: t.mSuggestedName, gender: t.mGender, qualTotal: t.mTotal },
      { ...base, firstName: t.fFirstName, lastName: t.fLastName, teamNoc: fNoc, isNew: t.fIsNew, shooterId: t.fShooterId, suggestedShooterId: t.fSuggestedShooterId, suggestedName: t.fSuggestedName, gender: t.fGender, qualTotal: t.fTotal },
    ];
  });
  return [...club, ...pairs];
}

const MEMBER_KEYS = ["firstName", "lastName", "teamNoc", "nationAssumed", "isNew", "shooterId", "suggestedShooterId", "suggestedName"] as const;
const SLOT_KEYS = { firstName: "FirstName", lastName: "LastName", isNew: "IsNew", shooterId: "ShooterId", suggestedShooterId: "SuggestedShooterId", suggestedName: "SuggestedName", gender: "Gender" } as const;

/** Izmena iz panela nad redom `index` iz `memberRows`; godište i klub timovi ne čuvaju. */
export function applyMemberPatch(teamResults: TeamResultEntry[], mixed: MixedTeamEntry[], index: number, patch: Partial<ReviewRow>) {
  const own = Object.fromEntries(MEMBER_KEYS.filter((k) => k in patch).map((k) => [k, patch[k]]));
  let left = index;
  const nextClubs = teamResults.map((team) => {
    if (team.skip) return team;
    const at = left;
    left -= team.members.length;
    return at >= 0 && at < team.members.length
      ? { ...team, members: team.members.map((m, i) => (i === at ? { ...m, ...own } : m)) }
      : team;
  });
  const nextMixed = mixed.map((team) => {
    if (team.skip) return team;
    const at = left;
    left -= 2;
    if (at < 0 || at > 1) return team;
    const slot = at === 0 ? "m" : "f";
    const next: MixedTeamEntry = {
      ...team,
      ...Object.fromEntries(Object.entries(SLOT_KEYS).filter(([k]) => k in patch).map(([k, suffix]) => [`${slot}${suffix}`, patch[k as keyof ReviewRow]])),
    };
    if (patch.teamNoc !== undefined) {
      const [m, f = m] = team.nocCode.split("/");
      const [newM, newF] = at === 0 ? [patch.teamNoc, f] : [m, patch.teamNoc];
      next.nocCode = newM === newF ? newM : `${newM}/${newF}`;
    }
    if ("nationAssumed" in patch) next.nationAssumed = patch.nationAssumed;
    return next;
  });
  if (patch.teamNoc !== undefined) numberTeams(nextMixed);
  return { teamResults: nextClubs, mixed: nextMixed };
}
