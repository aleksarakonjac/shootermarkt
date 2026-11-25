import { nameSimilarity } from "@/lib/name-similarity";
import type { SiusCompetition } from "@shootermarkt/adapters/sius/public-adapter";

const DAYS = 5;
const MIN_SCORE = 0.5;
const MIN_MARGIN = 0.2;

export interface SiusMatch {
  id: string;
  name: string;
  city: string | null;
  start: string;
  score: number;
  /** Safe to auto-link: strong score and a clear lead over the runner-up. */
  confident: boolean;
}

const dayDiff = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

/** Candidates within ±5 days, best first. Score = name overlap + city hit − 0.02/day. */
export function rankSiusCandidates(target: { name: string; date: string; location?: string | null }, sius: SiusCompetition[]) {
  return sius
    .filter((s) => dayDiff(s.start, target.date) <= DAYS)
    .map((s) => {
      const city = s.city?.toLowerCase();
      const cityHit = !!city && `${target.name} ${target.location ?? ""}`.toLowerCase().includes(city);
      return { s, score: nameSimilarity(target.name, s.name) + (cityHit ? 0.5 : 0) - dayDiff(s.start, target.date) * 0.02 };
    })
    .sort((a, b) => b.score - a.score);
}

/** Best SIUS match for a competition, skipping UUIDs in `takenIds`. null when nothing is in the date window. */
export function matchSiusCompetition(
  target: { name: string; date: string; location?: string | null },
  sius: SiusCompetition[],
  takenIds: ReadonlySet<string> = new Set(),
): SiusMatch | null {
  const cands = rankSiusCandidates(target, sius).filter((c) => !takenIds.has(c.s.id));
  const [best, second] = cands;
  if (!best) return null;
  return {
    id: best.s.id, name: best.s.name, city: best.s.city, start: best.s.start, score: best.score,
    confident: best.score >= MIN_SCORE && (!second || best.score - second.score >= MIN_MARGIN),
  };
}

/** Confident links only; a UUID goes to its best-scoring competition. */
export function pickSiusLinks(
  targets: Array<{ id: number; name: string; date: string; location?: string | null }>,
  sius: SiusCompetition[],
  takenIds: ReadonlySet<string> = new Set(),
): Map<number, string> {
  const best = new Map<string, { id: number; score: number }>();
  for (const target of targets) {
    const match = matchSiusCompetition(target, sius, takenIds);
    if (!match?.confident) continue;
    const current = best.get(match.id);
    if (!current || match.score > current.score) best.set(match.id, { id: target.id, score: match.score });
  }
  return new Map([...best].map(([siusId, { id }]) => [id, siusId]));
}
