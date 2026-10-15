import type { ArApFinalDetail, BulletinFinalDetail } from "@shootermarkt/db/schema";
import { deriveFinalRankProgression } from "@shootermarkt/db/pdf-import-types";

/**
 * ISSF finale (HTML: kumulativ + hici po fazi) → finalDetail koji tabela finala ume da prikaže.
 *
 * - 10m vazdušna puška/pištolj: `ar_ap_10m` (2 serije po 5 hitaca, pa pojedinačni hici
 *   sa označenom eliminacijom) — isti prikaz kao postojeće vazdušno finale.
 * - Trostav i sve što ne odgovara tom obliku: `bulletin` sa zbirom po fazi (S1…Sn),
 *   kumulativom i plasmanom posle svake faze — nikad ravna lista desetina hitaca.
 *
 * Svi ISSF finali koje uvozimo (AR/AP/R3P) boduju se decimalno.
 */

type IssfFinalEntry = { stageCumulatives: number[]; total: number; shotsByStage: number[][] };

const round1 = (value: number) => Math.round(value * 10) / 10;
const isAirEvent = (disciplineCode: string) => /^(AR|AP)[MW]$/.test(disciplineCode);

export function buildIssfFinalDetails(disciplineCode: string, finalists: IssfFinalEntry[]): Array<ArApFinalDetail | BulletinFinalDetail> {
  const allCumulatives = finalists.map((f) => f.stageCumulatives);
  const airShaped = isAirEvent(disciplineCode)
    && finalists.length > 0
    && finalists.every((f) => f.shotsByStage[0]?.length === 5 && f.shotsByStage[1]?.length === 5);

  if (airShaped) {
    const phase2Lengths = finalists.map((f) => f.shotsByStage.slice(2).flat().length);
    const longestPhase2 = Math.max(0, ...phase2Lengths);
    return finalists.map((f, i): ArApFinalDetail => {
      const [series1, series2] = f.shotsByStage;
      const shots = f.shotsByStage.slice(2).flat();
      return {
        format: "ar_ap_10m",
        phase1: { series: [series1, series2], subtotal: f.stageCumulatives[1] ?? round1([...series1, ...series2].reduce((a, b) => a + b, 0)) },
        // Ko ima manje hitaca u drugoj fazi od najdužeg, ispao je posle svog poslednjeg hica.
        phase2: { shots, eliminatedAfterShot: phase2Lengths[i] < longestPhase2 ? phase2Lengths[i] : null },
        total: f.total,
      };
    });
  }

  return finalists.map((f): BulletinFinalDetail => ({
    format: "bulletin",
    scoring: "decimal",
    series: f.stageCumulatives.map((cumulative, i) => round1(cumulative - (f.stageCumulatives[i - 1] ?? 0))),
    cumulative: f.stageCumulatives,
    ranks: deriveFinalRankProgression(f.stageCumulatives, allCumulatives) ?? undefined,
  }));
}
