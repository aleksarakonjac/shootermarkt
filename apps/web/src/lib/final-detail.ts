import type { BulletinFinalDetail } from "@shootermarkt/db/schema";
import { deriveFinalRankProgression } from "@shootermarkt/db/pdf-import-types";

/**
 * Finale (SIUS API ili ISSF HTML) → finalDetail prikazan kao na ISSF sajtu:
 * KUMULATIVNI zbir posle svake serije/faze, koji raste kako stižu hici (u toku serije
 * poslednja kolona je zbir do tog hica). Pojedinačni hici se (još) ne prikazuju.
 *
 * Serije finala:
 * - trostav: klečeći 10, ležeći 10, stojeći 5 + 5, pa pojedinačni stojeći hici (S1, S2…);
 * - vazdušno: 5 + 5, pa serije od po 2 hica (11–12, 13–14…), posle svake ispada poslednji.
 * SIUS daje zbir po seriji u tom redosledu. Kad su poznati pojedinačni hici (ISSF HTML,
 * ili SIUS ako vrati hice), grupišu se po istom pravilu, pa kolone uvek imaju iste nazive.
 * Sva finala koja uvozimo (AR/AP/R3P) boduju se decimalno.
 */

const round1 = (value: number) => Math.round(value * 10) / 10;
const isAirEvent = (code: string) => /^(AR|AP)[MW]$/.test(code);
const isThreePositionEvent = (code: string) => /^R3[PJ][MW]$/.test(code);

const MAX_SHOT_VALUE = 10.9;

type SeriesPlan = {
  /** Serije prve faze: broj hitaca + naziv kolone. */
  phase: Array<{ shots: number; label: string }>;
  /** Broj hitaca u svakoj sledećoj (eliminacionoj) seriji. */
  then: number;
};

function seriesPlan(disciplineCode: string): SeriesPlan | null {
  if (isThreePositionEvent(disciplineCode)) {
    return { phase: [{ shots: 10, label: "Klečeći" }, { shots: 10, label: "Ležeći" }, { shots: 5, label: "Stojeći 1" }, { shots: 5, label: "Stojeći 2" }], then: 1 };
  }
  if (isAirEvent(disciplineCode)) return { phase: [{ shots: 5, label: "S1" }, { shots: 5, label: "S2" }], then: 2 };
  return null;
}

/** Naziv i-te kolone: serija prve faze, pa pojedinačni hitac (S1…) ili par hitaca po rednom broju (11–12…). */
function seriesLabels(disciplineCode: string, count: number): string[] | undefined {
  const plan = seriesPlan(disciplineCode);
  if (!plan) return undefined;
  const phaseShots = plan.phase.reduce((sum, series) => sum + series.shots, 0);
  return Array.from({ length: count }, (_, i) => {
    if (plan.phase[i]) return plan.phase[i].label;
    const k = i - plan.phase.length;
    if (plan.then === 1) return `S${k + 1}`;
    const first = phaseShots + k * plan.then + 1;
    return `${first}–${first + plan.then - 1}`;
  });
}

/** Hronološki hici → kumulativ na kraju svake serije po planu (poslednja može biti nedovršena). */
function cumulativeFromShots(plan: SeriesPlan, shots: number[]): number[] {
  const out: number[] = [];
  let index = 0;
  let running = 0;
  for (let group = 0; index < shots.length; group++) {
    const size = plan.phase[group]?.shots ?? plan.then;
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
 * SIUS: `series` su zbirovi serija po planu (provereno: trostav [104.3, 104.9, …];
 * vazdušno: S1, S2, pa zbir svake serije od 2 hica).
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

/**
 * Za prikaz: finala sačuvana u starom obliku (samo `series`, bez kumulativa — stari cron
 * zapisi i admin SIUS uvoz) prevode se u isti kumulativni prikaz sa nazivima serija.
 * Samo za AR/AP/R3P; ostalo (npr. 25m pištolj, broj pogodaka) ostaje kako je.
 * `detailsByRank`: finalDetail finalista u redosledu plasmana.
 */
export function normalizeFinalDetailsForDisplay<T extends FinalDetailLike | null>(disciplineCode: string, detailsByRank: T[]): Array<T | BulletinFinalDetail> {
  if (!seriesPlan(disciplineCode)) return detailsByRank;
  // Ranije sačuvana finala trostava imaju pojedinačne hice kao H1, H2… → prikaz S1, S2…
  if (isThreePositionEvent(disciplineCode)) {
    detailsByRank = detailsByRank.map((d) => (d && d.seriesLabels?.some((l) => /^H\d+$/.test(l))
      ? { ...d, seriesLabels: d.seriesLabels.map((l) => l.replace(/^H(\d+)$/, "S$1")) }
      : d));
  }
  const isLegacySeries = (d: FinalDetailLike | null): d is BulletinFinalDetail =>
    d?.format === "bulletin" && !!d.series?.length && !d.cumulative?.length && !d.shots?.length && d.scoring !== "hit_count";
  const legacy: BulletinFinalDetail[] = [];
  for (const d of detailsByRank) if (isLegacySeries(d)) legacy.push(d);
  if (legacy.length === 0) return detailsByRank;
  const rebuilt = buildSiusFinalDetails(disciplineCode, legacy.map((d) => ({ series: d.series ?? [] })));
  let next = 0;
  return detailsByRank.map((d) => (isLegacySeries(d) ? rebuilt[next++] : d));
}

type FinalDetailLike = { format: string; series?: number[]; cumulative?: number[]; shots?: number[]; scoring?: string; seriesLabels?: string[] };
