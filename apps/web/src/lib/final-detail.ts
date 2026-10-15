import type { ArApFinalDetail, BulletinFinalDetail, PositionsFinalDetail } from "@shootermarkt/db/schema";
import { deriveFinalRankProgression } from "@shootermarkt/db/pdf-import-types";

/**
 * Finale (ISSF HTML ili SIUS API) → finalDetail koji tabela finala ume da prikaže.
 *
 * Gradi se iz HRONOLOŠKOG niza hitaca, pa ne zavisi od toga kako izvor grupiše faze:
 * - 10m vazdušno (AR/AP): 5 + 5 hitaca, pa pojedinačni hici → `ar_ap_10m`.
 * - Trostav (R3P): 10 klečeći, 10 ležeći, stojeći 5 + 5, pa pojedinačni stojeći hici
 *   (pre njih ispadaju 8. i 7., posle svakog hica poslednji plasirani) → `3x40_mk`.
 * - Kad pojedinačni hici nisu poznati (izvor daje samo zbirove serija): `bulletin`
 *   sa zbirom po seriji, kumulativom i plasmanom posle svake serije.
 *
 * Sva finala koja uvozimo (AR/AP/R3P) boduju se decimalno.
 */

export type AnyFinalDetail = ArApFinalDetail | PositionsFinalDetail | BulletinFinalDetail;
type Finalist = { shots: number[]; total: number };

const MAX_SHOT_VALUE = 10.9;
const round1 = (value: number) => Math.round(value * 10) / 10;
const sum = (values: number[]) => round1(values.reduce((a, b) => a + b, 0));
const isAirEvent = (code: string) => /^(AR|AP)[MW]$/.test(code);
const isThreePositionEvent = (code: string) => /^R3[PJ][MW]$/.test(code);

/** Broj hitaca u drugoj fazi i ko je ispao posle kog hica (null = izdržao do kraja). */
function phase2Eliminations(finalists: Finalist[], phase1Shots: number) {
  const lengths = finalists.map((f) => Math.max(0, f.shots.length - phase1Shots));
  const longest = Math.max(0, ...lengths);
  return lengths.map((length) => (length < longest ? length : null));
}

function airDetails(finalists: Finalist[]): ArApFinalDetail[] {
  const eliminated = phase2Eliminations(finalists, 10);
  return finalists.map((f, i) => ({
    format: "ar_ap_10m",
    phase1: { series: [f.shots.slice(0, 5), f.shots.slice(5, 10)], subtotal: sum(f.shots.slice(0, 10)) },
    phase2: { shots: f.shots.slice(10), eliminatedAfterShot: eliminated[i] },
    total: f.total,
  }));
}

function threePositionDetails(finalists: Finalist[]): PositionsFinalDetail[] {
  const eliminated = phase2Eliminations(finalists, 30);
  const phase2Started = finalists.some((f) => f.shots.length > 30);
  // Ispali posle prve faze (pre pojedinačnih hitaca): bez ijednog hica u drugoj fazi, a ona je počela.
  const phase1Eliminations = phase2Started
    ? finalists.flatMap((f, i) => (f.shots.length <= 30 ? [i + 1] : []))
    : [];
  return finalists.map((f, i) => {
    const kneeling = f.shots.slice(0, 10);
    const prone = f.shots.slice(10, 20);
    const standing1 = f.shots.slice(20, 25);
    const standing2 = f.shots.slice(25, 30);
    return {
      format: "3x40_mk",
      phase1: {
        kneeling: { shots: kneeling, total: sum(kneeling) },
        prone: { shots: prone, total: sum(prone) },
        standing: { series1: standing1, series2: standing2, total: sum([...standing1, ...standing2]) },
        subtotal: sum(f.shots.slice(0, 30)),
      },
      phase1Eliminations,
      phase2: { shots: f.shots.slice(30), eliminatedAfterShot: f.shots.length > 30 ? eliminated[i] : null },
      total: f.total,
    };
  });
}

function seriesDetails(seriesPerFinalist: number[][]): BulletinFinalDetail[] {
  const cumulatives = seriesPerFinalist.map((series) => series.map((_, i) => sum(series.slice(0, i + 1))));
  return seriesPerFinalist.map((series, i) => ({
    format: "bulletin",
    scoring: "decimal",
    series,
    cumulative: cumulatives[i],
    ranks: deriveFinalRankProgression(cumulatives[i], cumulatives) ?? undefined,
  }));
}

/** Finalisti moraju biti u redosledu plasmana (1., 2., …). */
export function buildFinalDetailsFromShots(disciplineCode: string, finalists: Finalist[]): AnyFinalDetail[] {
  if (isAirEvent(disciplineCode)) return airDetails(finalists);
  if (isThreePositionEvent(disciplineCode)) return threePositionDetails(finalists);
  return seriesDetails(finalists.map((f) => f.shots));
}

/** ISSF HTML: hici po fazi → hronološki niz. Finalisti u redosledu plasmana. */
export function buildIssfFinalDetails(
  disciplineCode: string,
  finalists: Array<{ shotsByStage: number[][]; total: number }>,
): AnyFinalDetail[] {
  return buildFinalDetailsFromShots(disciplineCode, finalists.map((f) => ({ shots: f.shotsByStage.flat(), total: f.total })));
}

const isShot = (value: number) => value <= MAX_SHOT_VALUE;

/**
 * SIUS trostav: `series` = [klečeći (10), ležeći (10), stojeći 5, stojeći 5, pa pojedinačni hici].
 * Pojedinačni hici nisu poznati za prvu fazu, pa su nizovi hitaca prazni a ukupno je zbir stava.
 */
function threePositionFromSeriesTotals(finalists: Array<{ series: number[]; total: number }>): PositionsFinalDetail[] {
  const phase2Lengths = finalists.map((f) => Math.max(0, f.series.length - 4));
  const longest = Math.max(0, ...phase2Lengths);
  const phase1Eliminations = longest > 0 ? finalists.flatMap((_, i) => (phase2Lengths[i] === 0 ? [i + 1] : [])) : [];
  return finalists.map((f, i) => {
    const [kneeling = 0, prone = 0, standing1 = 0, standing2 = 0] = f.series;
    return {
      format: "3x40_mk",
      phase1: {
        kneeling: { shots: [], total: kneeling },
        prone: { shots: [], total: prone },
        standing: { series1: [], series2: [], total: round1(standing1 + standing2) },
        subtotal: sum(f.series.slice(0, 4)),
      },
      phase1Eliminations,
      phase2: { shots: f.series.slice(4), eliminatedAfterShot: phase2Lengths[i] > 0 && phase2Lengths[i] < longest ? phase2Lengths[i] : null },
      total: f.total,
    };
  });
}

/**
 * SIUS API: `series` je u finalu niz vrednosti koje mogu biti pojedinačni hici ili zbirovi.
 * - sve ≤ 10.9 → hici → pun format (vazdušno / trostav).
 * - trostav sa zbirovima stavova (provereno na živom SIUS finalu: [104.3, 104.9, …]) → format trostava.
 * - vazdušno: 2 zbira od po 5, pa pojedinačni hici → format vazdušnog finala.
 * - sve ostalo → prikaz po serijama.
 */
export function buildSiusFinalDetails(
  disciplineCode: string,
  finalists: Array<{ series: number[]; total: number }>,
): AnyFinalDetail[] {
  const values = finalists.flatMap((f) => f.series);
  if (values.length > 0 && values.every(isShot)) {
    return buildFinalDetailsFromShots(disciplineCode, finalists.map((f) => ({ shots: f.series, total: f.total })));
  }
  if (isThreePositionEvent(disciplineCode) && finalists.every((f) => f.series.slice(4).every(isShot))) {
    return threePositionFromSeriesTotals(finalists);
  }
  if (isAirEvent(disciplineCode) && finalists.every((f) => f.series.slice(2).every(isShot))) {
    const eliminated = phase2Eliminations(finalists.map((f) => ({ shots: f.series, total: f.total })), 2);
    return finalists.map((f, i): ArApFinalDetail => ({
      format: "ar_ap_10m",
      // Zbir serije kao jedini "hitac" — tabela prikazuje zbir serije, pa je rezultat isti.
      phase1: { series: [f.series.slice(0, 1), f.series.slice(1, 2)], subtotal: sum(f.series.slice(0, 2)) },
      phase2: { shots: f.series.slice(2), eliminatedAfterShot: eliminated[i] },
      total: f.total,
    }));
  }
  return seriesDetails(finalists.map((f) => f.series));
}
