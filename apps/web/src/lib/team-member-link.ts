// Čiste funkcije (bez DB-a) za upis timova: koji strelac je član tima i da li se ekipa promenila.
import { isDeepStrictEqual } from "node:util";
import { foldName, nameKey } from "@shootermarkt/db/name-match";

export type CompetitionShooter = { shooterId: number; firstName: string; lastName: string };

/**
 * Veza člana tima: postojeća (nikad se ne gazi) → izbor iz pregleda → jedini strelac tog imena među
 * pojedinačnim rezultatima istog takmičenja. null = traži dalje (baza strelaca ili novi strelac).
 */
export function pickMemberShooter(m: { firstName: string; lastName: string; shooterId?: number }, existing: number | null, individuals: CompetitionShooter[]): number | null {
  if (existing) return existing;
  if (m.shooterId) return m.shooterId;
  const key = nameKey(m.firstName, m.lastName);
  const found = new Set(individuals.filter((s) => nameKey(s.firstName, s.lastName) === key).map((s) => s.shooterId));
  return found.size === 1 ? [...found][0] : null;
}

type Score = string | number | null;
export type TeamSnapshot = {
  rank: number | null; total: Score; inners: number | null; remark: string | null;
  members: { name: string; series: number[]; total: Score; inners: number | null; shooterId: number | null }[];
};

const score = (v: Score) => (v == null ? null : Number(v).toFixed(1));
const placement = (t: TeamSnapshot) => [t.rank, score(t.total), t.inners, t.remark];

/** Šta bi upis ekipe promenio; `next` bez veze (pregled pre upisa) se ne računa kao razlika u vezi. */
export function teamDiff(old: TeamSnapshot, next: TeamSnapshot): string[] {
  const lineUp = (t: TeamSnapshot, withLink: boolean[]) =>
    t.members.map((m, i) => [foldName(m.name), m.series, score(m.total), m.inners, withLink[i] ? m.shooterId : null]);
  const linked = next.members.map((m) => m.shooterId != null);
  return [
    ...(isDeepStrictEqual(placement(old), placement(next)) ? [] : ["plasman"]),
    ...(isDeepStrictEqual(lineUp(old, linked), lineUp(next, linked)) ? [] : ["sastav"]),
  ];
}
