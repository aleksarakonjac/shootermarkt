import type { BulletinFinalDetail } from "@shootermarkt/db/schema";
import { deriveFinalRankProgression } from "@shootermarkt/db/pdf-import-types";

/**
 * Finale (SIUS API ili ISSF HTML) → finalDetail prikazan kao na ISSF sajtu:
 * KUMULATIVNI zbir posle svake serije/faze, koji raste kako stižu hici (u toku serije
 * poslednja kolona je zbir do tog hica). Pojedinačni hici se (još) ne prikazuju.
 *
 * SIUS u finalu daje zbir po seriji: trostav [klečeći, ležeći, stojeći 5, stojeći 5,
 * pa pojedinačni hici], vazdušno [5, 5, pa pojedinačni hici]. ISSF daje kumulativ po fazi.
 * Sva finala koja uvozimo (AR/AP/R3P) boduju se decimalno.
 */

const round1 = (value: number) => Math.round(value * 10) / 10;
const isAirEvent = (code: string) => /^(AR|AP)[MW]$/.test(code);
const isThreePositionEvent = (code: string) => /^R3[PJ][MW]$/.test(code);

/** Nazivi kolona za SIUS serije; posle faza serija dolaze pojedinačni hici H1, H2… */
function siusSeriesLabels(disciplineCode: string, count: number): string[] | undefined {
  const phases = isThreePositionEvent(disciplineCode)
    ? ["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2"]
    : isAirEvent(disciplineCode) ? ["S1", "S2"] : null;
  if (!phases) return undefined;
  return Array.from({ length: count }, (_, i) => phases[i] ?? `H${i - phases.length + 1}`);
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

/** SIUS: zbirovi po seriji → kumulativ. Finalisti u redosledu plasmana. */
export function buildSiusFinalDetails(disciplineCode: string, finalists: Array<{ series: number[] }>): BulletinFinalDetail[] {
  const cumulatives = finalists.map((f) => {
    let running = 0;
    return f.series.map((value) => (running = round1(running + value)));
  });
  const longest = Math.max(0, ...cumulatives.map((c) => c.length));
  return cumulativeDetails(cumulatives, siusSeriesLabels(disciplineCode, longest));
}

/** ISSF: već kumulativ po fazi (kao na sajtu). Grupisanje faza nije poznato, pa bez naziva kolona. */
export function buildIssfFinalDetails(finalists: Array<{ stageCumulatives: number[] }>): BulletinFinalDetail[] {
  return cumulativeDetails(finalists.map((f) => f.stageCumulatives));
}
