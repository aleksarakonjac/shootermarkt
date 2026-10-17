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

const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2));
function jaccard(a: string, b: string) {
  const ta = tokens(a), tb = tokens(b);
  const inter = [...ta].filter((w) => tb.has(w)).length;
  const union = new Set([...ta, ...tb]).size;
  return union ? inter / union : 0;
}
const dayDiff = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

/** Candidates within ±5 days, best first. Score = name overlap + city hit − 0.02/day. */
export function rankSiusCandidates(target: { name: string; date: string; location?: string | null }, sius: SiusCompetition[]) {
  return sius
    .filter((s) => dayDiff(s.start, target.date) <= DAYS)
    .map((s) => {
      const city = s.city?.toLowerCase();
      const cityHit = !!city && `${target.name} ${target.location ?? ""}`.toLowerCase().includes(city);
      return { s, score: jaccard(target.name, s.name) + (cityHit ? 0.5 : 0) - dayDiff(s.start, target.date) * 0.02 };
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
