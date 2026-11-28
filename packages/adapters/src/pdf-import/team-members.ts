/** Povezivanje članova klupskih i mešovitih timova sa strelcima iz baze, za pregled PDF uvoza (bez baze). */
import { matchShooter, nameKey, normalizeNoc, type AgeContext, type MatchCandidate } from "@shootermarkt/db/name-match";
import { DISCIPLINE_META, type DisciplineCode, type MixedTeamEntry, type ReviewRow, type TeamResultEntry } from "@shootermarkt/db/pdf-import-types";

type Member = { firstName: string; lastName: string; teamNoc: string };
type Match = { shooterId?: number; isNew?: boolean; suggestedShooterId?: number; suggestedName?: string };

/**
 * Veza člana tima ostaje i posle ponovnog uvoza, pa se sama pravi samo za siguran pogodak: tačno ime,
 * ista država i uzrast koji odgovara kategoriji (isto kao linkTeamMembers). Sve slabije je predlog.
 */
export function matchMember(m: Member, shooters: MatchCandidate[], age?: AgeContext): Match {
  const noc = m.teamNoc.toUpperCase();
  const nation = normalizeNoc(noc);
  const sameNation = shooters.filter((s) => s.nationality && normalizeNoc(s.nationality) === nation);
  const sure = matchShooter(m.firstName, m.lastName, noc, sameNation, { exactOnly: true, age });
  if (sure.kind === "exact") return { shooterId: sure.id, isNew: false };
  const loose = matchShooter(m.firstName, m.lastName, noc, shooters, { age });
  if (loose.kind === "none") return { isNew: true };
  const found = shooters.find((s) => s.id === loose.id)!;
  return { isNew: true, suggestedShooterId: loose.id, suggestedName: loose.kind === "suggestion" ? loose.name : `${found.firstName} ${found.lastName}` };
}

export function matchTeamMembers(teamResults: TeamResultEntry[], mixed: MixedTeamEntry[], rows: ReviewRow[], shooters: MatchCandidate[], date?: string) {
  const apparatus = (code: DisciplineCode) => DISCIPLINE_META[code]?.apparatus;
  const rowKey = (m: { firstName: string; lastName: string }, code: DisciplineCode) => `${apparatus(code)}|${nameKey(m.firstName, m.lastName)}`;
  const rowByName = new Map(rows.map((r) => [rowKey(r, r.disciplineCode), r]));
  /**
   * Strelac sa pojedinačnim redom u istom biltenu vezuje se pri upisu preko tog rezultata (admin ga u
   * pregledu može promeniti), pa ovde ne dobija sopstvenu vezu — samo isto stanje "novi"/predlog.
   */
  const resolve = (m: Member, code: DisciplineCode, category: string | undefined, day: string | null | undefined): Match => {
    const row = rowByName.get(rowKey(m, code));
    return row ? { isNew: row.isNew, suggestedShooterId: row.suggestedShooterId, suggestedName: row.suggestedName }
      : matchMember(m, shooters, { category, date: day ?? date });
  };
  return {
    teamResults: teamResults.map((team) => ({
      ...team,
      members: team.members.map((m) => {
        // isti strelac na pojedinačnoj listi: njegova nacija važi i ovde, da pregled vidi jednog novog strelca
        const row = rowByName.get(rowKey(m, team.disciplineCode));
        const own = row ? { ...m, teamNoc: row.teamNoc, nationAssumed: row.nationAssumed } : m;
        return { ...own, ...resolve(own, team.disciplineCode, team.category, team.eventDate) };
      }),
    })),
    mixed: mixed.map((t) => {
      const [mNoc, fNoc = mNoc] = t.nocCode.split("/");
      const m = resolve({ firstName: t.mFirstName, lastName: t.mLastName, teamNoc: mNoc }, t.disciplineCode, t.category, t.eventDate);
      const f = resolve({ firstName: t.fFirstName, lastName: t.fLastName, teamNoc: fNoc }, t.disciplineCode, t.category, t.eventDate);
      return {
        ...t, createMissing: true,
        mShooterId: m.shooterId, mIsNew: m.isNew, mSuggestedShooterId: m.suggestedShooterId, mSuggestedName: m.suggestedName, mGender: "M" as const,
        fShooterId: f.shooterId, fIsNew: f.isNew, fSuggestedShooterId: f.suggestedShooterId, fSuggestedName: f.suggestedName, fGender: "F" as const,
      };
    }),
  };
}
