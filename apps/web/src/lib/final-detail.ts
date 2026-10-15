import type { BulletinFinalDetail } from "@shootermarkt/db/schema";
import { deriveFinalRankProgression } from "@shootermarkt/db/pdf-import-types";

/**
 * Finale (SIUS API ili ISSF HTML) → finalDetail prikazan kao na ISSF sajtu:
 * KUMULATIVNI zbir posle svake serije/faze, koji raste kako stižu hici (u toku serije
 * poslednja kolona je zbir do tog hica). Pojedinačni hici se (još) ne prikazuju.
 *
 * Serije finala:
 * - trostav: klečeći 10, ležeći 10, stojeći 5 + 5, pa pojedinačni stojeći hici;
 * - vazdušno: 5 + 5, pa pojedinačni hici.
 * SIUS daje zbir po seriji u tom redosledu. Kad su poznati pojedinačni hici (ISSF HTML,
 * ili SIUS ako vrati hice), grupišu se po istom pravilu, pa kolone uvek imaju iste nazive.
 * Sva finala koja uvozimo (AR/AP/R3P) boduju se decimalno.
 */

const round1 = (value: number) => Math.round(value * 10) / 10;
const isAirEvent = (code: string) => /^(AR|AP)[MW]$/.test(code);
const isThreePositionEvent = (code: string) => /^R3[PJ][MW]$/.test(code);

const MAX_SHOT_VALUE = 10.9;

/** Serije prve faze (broj hitaca + naziv); posle njih svaki hitac je svoja kolona H1, H2… */
function seriesPlan(disciplineCode: string): Array<{ shots: number; label: string }> | null {
  if (isThreePositionEvent(disciplineCode)) {
    return [{ shots: 10, label: "Klečeći" }, { shots: 10, label: "Ležeći" }, { shots: 5, label: "Stojeći 1" }, { shots: 5, label: "Stojeći 2" }];
  }
  if (isAirEvent(disciplineCode)) return [{ shots: 5, label: "S1" }, { shots: 5, label: "S2" }];
  return null;
}

function seriesLabels(disciplineCode: string, count: number): string[] | undefined {
  const plan = seriesPlan(disciplineCode);
  if (!plan) return undefined;
  return Array.from({ length: count }, (_, i) => plan[i]?.label ?? `H${i - plan.length + 1}`);
}

/** Hronološki hici → kumulativ na kraju svake serije po planu (poslednja može biti nedovršena). */
function cumulativeFromShots(plan: Array<{ shots: number }>, shots: number[]): number[] {
  const out: number[] = [];
  let index = 0;
  let running = 0;
  for (let group = 0; index < shots.length; group++) {
    const size = plan[group]?.shots ?? 1;
    for (const shot of shots.slice(index, index + size)) running += shot;
    index += size;
    out.push(round1(running));
  }
  return out;
}

function cumulativeDetails(cumulatives: number[][], seriesLabels?: string[]): BulletinFinalDetail[] {
  return cumulatives.map((cumulative) => ({
    format: "bulletin",
    scoring: "decimal",
    cumulative,
    ...(seriesLabels ? { seriesLabels } : {}),
    ranks: deriveFinalRankProgression(cumulative, cumulatives) ?? undefined,
  }));
}

function labelled(disciplineCode: string, cumulatives: number[][]) {
  const longest = Math.max(0, ...cumulatives.map((c) => c.length));
  return cumulativeDetails(cumulatives, seriesLabels(disciplineCode, longest));
}

/**
 * SIUS: `series` su zbirovi serija po planu (provereno: trostav [104.3, 104.9, …]).
 * Ako su sve vrednosti ≤ 10.9, to su pojedinačni hici → grupišu se po planu.
 */
export function buildSiusFinalDetails(disciplineCode: string, finalists: Array<{ series: number[] }>): BulletinFinalDetail[] {
  const plan = seriesPlan(disciplineCode);
  const values = finalists.flatMap((f) => f.series);
  const areShots = plan != null && values.length > 0 && values.every((v) => v <= MAX_SHOT_VALUE);
  const cumulatives = finalists.map((f) => {
    if (areShots) return cumulativeFromShots(plan, f.series);
    let running = 0;
    return f.series.map((value) => (running = round1(running + value)));
  });
  return labelled(disciplineCode, cumulatives);
}

/**
 * ISSF: pojedinačni hici (po fazi) → regrupišu se po planu discipline, jer ISSF faze ne
 * odgovaraju uvek serijama. Ako hici nisu dostupni, ostaje ISSF kumulativ po fazi (F1, F2…).
 */
export function buildIssfFinalDetails(
  disciplineCode: string,
  finalists: Array<{ stageCumulatives: number[]; shotsByStage: number[][]; total: number }>,
): BulletinFinalDetail[] {
  const plan = seriesPlan(disciplineCode);
  const shotsMatchTotal = (f: (typeof finalists)[number]) => {
    const shots = f.shotsByStage.flat();
    return shots.length > 0 && Math.abs(shots.reduce((a, b) => a + b, 0) - f.total) < 0.05;
  };
  if (plan && finalists.length > 0 && finalists.every(shotsMatchTotal)) {
    return labelled(disciplineCode, finalists.map((f) => cumulativeFromShots(plan, f.shotsByStage.flat())));
  }
  return cumulativeDetails(finalists.map((f) => f.stageCumulatives));
}
