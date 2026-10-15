import { describe, expect, it } from "vitest";
import { buildIssfFinalDetails, buildSiusFinalDetails } from "./final-detail";

const shots = (count: number, value = 10.2) => Array.from({ length: count }, () => value);

describe("buildIssfFinalDetails", () => {
  it("maps a 10m air final to 5+5 series then single shots, marking eliminations", () => {
    const winner = { shotsByStage: [shots(5, 10.5), shots(5, 10.4), [10.6, 10.2], [10.9, 10.1]], total: 146.3 };
    const eighth = { shotsByStage: [shots(5, 10), shots(5, 10), [9.9, 9.8]], total: 119.7 };
    const [a, b] = buildIssfFinalDetails("ARW", [winner, eighth]);

    expect(a).toEqual({ format: "ar_ap_10m", phase1: { series: [shots(5, 10.5), shots(5, 10.4)], subtotal: 104.5 }, phase2: { shots: [10.6, 10.2, 10.9, 10.1], eliminatedAfterShot: null }, total: 146.3 });
    expect(b).toMatchObject({ format: "ar_ap_10m", phase2: { shots: [9.9, 9.8], eliminatedAfterShot: 2 } });
  });

  it("maps a 3P final: 10 kneeling, 10 prone, 5+5 standing, then single standing shots", () => {
    // 1. i 2. do kraja (5 pojedinačnih), 3.–6. ispadaju redom, 7. i 8. pre pojedinačnih hitaca.
    const singles = [5, 5, 4, 3, 2, 1, 0, 0];
    const finalists = singles.map((n, i) => ({ shotsByStage: [shots(30), shots(n, 10)], total: 300 - i }));
    const details = buildIssfFinalDetails("R3PM", finalists);

    expect(details[0]).toMatchObject({
      format: "3x40_mk",
      phase1: { kneeling: { total: 102 }, prone: { total: 102 }, standing: { series1: shots(5), series2: shots(5), total: 102 }, subtotal: 306 },
      phase1Eliminations: [7, 8],
      phase2: { shots: shots(5, 10), eliminatedAfterShot: null },
    });
    expect(details.map((d) => d.format === "3x40_mk" && d.phase2.eliminatedAfterShot)).toEqual([null, null, 4, 3, 2, 1, null, null]);
  });
});

describe("buildSiusFinalDetails", () => {
  it("treats per-shot values as shots and builds the full air layout", () => {
    const [detail] = buildSiusFinalDetails("APM", [{ series: shots(12, 9.8), total: 117.6 }]);
    expect(detail).toMatchObject({ format: "ar_ap_10m", phase2: { shots: [9.8, 9.8] } });
  });

  // Pravi SIUS odgovor (finale trostava M, 15.10.2026, posle klečećeg i ležećeg): zbir po stavu.
  const live3p = [[104.3, 104.9], [102.0, 105.4], [103.0, 103.7], [102.7, 103.8], [102.0, 104.5], [102.2, 103.8], [102.6, 102.8], [100.1, 103.0]]
    .map((series) => ({ series, total: Math.round((series[0] + series[1]) * 10) / 10 }));

  it("maps live SIUS 3P position totals into the 3-position layout", () => {
    const details = buildSiusFinalDetails("R3PM", live3p);
    expect(details[0]).toMatchObject({
      format: "3x40_mk",
      phase1: { kneeling: { total: 104.3 }, prone: { total: 104.9 }, standing: { total: 0 }, subtotal: 209.2 },
      phase1Eliminations: [],
      phase2: { shots: [], eliminatedAfterShot: null },
      total: 209.2,
    });
  });

  it("marks 7th/8th out before the single shots and later eliminations per shot", () => {
    const singles = [[10.5, 10.1, 10.4, 10.2, 10.6], [10.3, 10.2, 10.0, 10.8, 9.9], [10.1, 9.8, 10.4, 10.0], [9.9, 10.2, 9.7], [10.0, 9.5], [9.6], [], []];
    const finished = live3p.map((f, i) => ({ series: [...f.series, 51.2, 50.8, ...singles[i]], total: 0 }));
    const details = buildSiusFinalDetails("R3PM", finished);
    expect(details.map((d) => d.format === "3x40_mk" && d.phase2.eliminatedAfterShot)).toEqual([null, null, 4, 3, 2, 1, null, null]);
    expect(details[0]).toMatchObject({ phase1: { standing: { total: 102 } }, phase1Eliminations: [7, 8] });
  });

  it("maps SIUS air series totals (5+5) followed by single shots", () => {
    const [detail] = buildSiusFinalDetails("ARW", [{ series: [52.4, 51.9, 10.6, 10.3], total: 125.2 }]);
    expect(detail).toMatchObject({ format: "ar_ap_10m", phase1: { series: [[52.4], [51.9]], subtotal: 104.3 }, phase2: { shots: [10.6, 10.3] } });
  });

  it("falls back to per-series columns for anything else", () => {
    const [a, b] = buildSiusFinalDetails("SPW", [{ series: [52.1, 51.3], total: 103.4 }, { series: [51.0, 50.2], total: 101.2 }]);
    expect(a).toMatchObject({ format: "bulletin", series: [52.1, 51.3], cumulative: [52.1, 103.4], ranks: [1, 1] });
    expect(b).toMatchObject({ cumulative: [51, 101.2], ranks: [2, 2] });
  });
});
