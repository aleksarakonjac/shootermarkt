import { describe, expect, it } from "vitest";
import { buildIssfFinalDetails, buildSiusFinalDetails, normalizeFinalDetailsForDisplay } from "./final-detail";

// Pravi SIUS odgovor (finale trostava M, 15.10.2026, posle klečećeg i ležećeg): zbir po stavu.
const live3p = [[104.3, 104.9], [102.0, 105.4], [103.0, 103.7], [102.7, 103.8], [102.0, 104.5], [102.2, 103.8], [102.6, 102.8], [100.1, 103.0]]
  .map((series) => ({ series }));

describe("buildSiusFinalDetails", () => {
  it("turns SIUS 3P position totals into a running cumulative with position labels", () => {
    const details = buildSiusFinalDetails("R3PM", live3p);
    expect(details[0]).toEqual({ format: "bulletin", scoring: "decimal", cumulative: [104.3, 209.2], seriesLabels: ["Klečeći", "Ležeći"], ranks: [1, 1] });
    expect(details[6]).toMatchObject({ cumulative: [102.6, 205.4], ranks: [4, 7] });
  });

  it("labels standing series and single shots once they arrive", () => {
    const [detail] = buildSiusFinalDetails("R3PW", [{ series: [104.3, 104.9, 51.2, 50.8, 10.5, 10.1] }]);
    expect(detail).toMatchObject({ cumulative: [104.3, 209.2, 260.4, 311.2, 321.7, 331.8], seriesLabels: ["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2", "S1", "S2"] });
  });

  it("groups SIUS per-shot values by the 3P plan when the API returns single shots", () => {
    const [detail] = buildSiusFinalDetails("R3PW", [{ series: [...shots(10, 10.4), ...shots(10, 10.5), ...shots(5, 10.1), ...shots(5, 10.2), 10.7] }]);
    expect(detail).toMatchObject({ cumulative: [104, 209, 259.5, 310.5, 321.2], seriesLabels: ["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2", "S1"] });
  });

  it("labels SIUS air finals S1, S2, then 2-shot series by shot numbers", () => {
    const [detail] = buildSiusFinalDetails("ARW", [{ series: [52.4, 51.9, 20.9, 21.1] }]);
    expect(detail).toMatchObject({ cumulative: [52.4, 104.3, 125.2, 146.3], seriesLabels: ["S1", "S2", "11–12", "13–14"] });
  });

  it("groups SIUS air per-shot values into 5+5 then pairs", () => {
    const [detail] = buildSiusFinalDetails("APM", [{ series: [...shots(10, 10), 10.5, 10.1, 9.9] }]);
    expect(detail).toMatchObject({ cumulative: [50, 100, 120.6, 130.5], seriesLabels: ["S1", "S2", "11–12", "13–14"] });
  });
});

describe("legacy (pre-12/2025) 3P finals", () => {
  const cumulative = [51.1, 102.8, 154.5, 206.4, 257.4, 309.7, 360.8, 411.6, 421.9, 432.2];
  it("relabels stored 2025 finals as eight 5-shot series, then single shots", () => {
    const stored = { format: "bulletin", scoring: "decimal", cumulative, seriesLabels: ["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2", "S1", "S2", "S3", "S4", "S5", "S6"] };
    const [detail] = normalizeFinalDetailsForDisplay("R3PM", [stored]);
    expect(detail).toMatchObject({ seriesLabels: ["Klečeći 1", "Klečeći 2", "Klečeći 3", "Ležeći 1", "Ležeći 2", "Ležeći 3", "Stojeći 1", "Stojeći 2", "S1", "S2"] });
  });
  it("leaves current-format finals alone", () => {
    const current = { format: "bulletin", scoring: "decimal", cumulative: [104.3, 209.2], seriesLabels: ["Klečeći", "Ležeći"] };
    expect(normalizeFinalDetailsForDisplay("R3PM", [current])[0]).toBe(current);
  });
  it("SIUS series sums starting with a 5-shot series use the legacy labels", () => {
    const [detail] = buildSiusFinalDetails("R3PM", [{ series: [51.1, 51.7, 51.7] }]);
    expect(detail.seriesLabels).toEqual(["Klečeći 1", "Klečeći 2", "Klečeći 3"]);
  });
});

const shots = (count: number, value: number) => Array.from({ length: count }, () => value);

describe("buildIssfFinalDetails", () => {
  it("regroups ISSF 3P shots into kneeling 10, prone 10, standing 5+5, then single shots", () => {
    // ISSF faze grupisane drugačije (npr. po 5) — bitan je samo hronološki niz hitaca.
    const stages = [shots(5, 10.2), shots(5, 10.4), shots(5, 10.5), shots(5, 10.3), shots(5, 10.0), shots(5, 9.8), [10.6], [10.1]];
    const total = Math.round(stages.flat().reduce((a, b) => a + b, 0) * 10) / 10;
    const [detail] = buildIssfFinalDetails("R3PM", [{ stageCumulatives: [51, 103, 155.5, 207, 257, 306, 316.6, 326.7], shotsByStage: stages, total }]);
    expect(detail).toMatchObject({
      cumulative: [103, 207, 257, 306, 316.6, 326.7],
      seriesLabels: ["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2", "S1", "S2"],
    });
  });

  it("regroups ISSF air shots into 5+5 then 2-shot series, with a partial series while live", () => {
    const [done, live] = buildIssfFinalDetails("APW", [
      { stageCumulatives: [], shotsByStage: [shots(5, 10), shots(5, 9.8), [10.4, 10.2], [10.0, 9.6]], total: 139.2 },
      { stageCumulatives: [], shotsByStage: [shots(3, 10)], total: 30 },
    ]);
    expect(done).toMatchObject({ cumulative: [50, 99, 119.6, 139.2], seriesLabels: ["S1", "S2", "11–12", "13–14"] });
    expect(live).toMatchObject({ cumulative: [30] });
  });

  it("keeps ISSF stage cumulatives (F1…) when individual shots are not available", () => {
    const [a, b] = buildIssfFinalDetails("ARW", [{ stageCumulatives: [52.5, 104.5], shotsByStage: [], total: 104.5 }, { stageCumulatives: [53.0, 103.9], shotsByStage: [], total: 103.9 }]);
    expect(a).toEqual({ format: "bulletin", scoring: "decimal", cumulative: [52.5, 104.5], ranks: [2, 1] });
    expect(b).toMatchObject({ ranks: [1, 2] });
  });
});

describe("normalizeFinalDetailsForDisplay", () => {
  it("shows legacy series-only 3P finals (old cron rows, admin SIUS import) with position labels", () => {
    const legacy = [
      { format: "bulletin" as const, scoring: "decimal" as const, series: [103.1, 104.0, 51.2, 50.9, 10.4] },
      { format: "bulletin" as const, scoring: "decimal" as const, series: [102.5, 104.2, 50.8, 50.6] },
    ];
    const [a, b] = normalizeFinalDetailsForDisplay("R3PW", legacy);
    expect(a).toMatchObject({ cumulative: [103.1, 207.1, 258.3, 309.2, 319.6], seriesLabels: ["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2", "S1"] });
    expect(b).toMatchObject({ cumulative: [102.5, 206.7, 257.5, 308.1] });
  });

  it("leaves new cumulative details and non-AR/AP/R3P finals untouched", () => {
    const current = buildSiusFinalDetails("R3PM", [{ series: [104.3, 104.9] }]);
    expect(normalizeFinalDetailsForDisplay("R3PM", current)).toEqual(current);
    const spw = [{ format: "bulletin" as const, scoring: "hit_count" as const, series: [5, 4, 5] }];
    expect(normalizeFinalDetailsForDisplay("SPW", spw)).toEqual(spw);
  });
});

describe("3P single-shot labels", () => {
  it("labels single standing shots S1, S2 and renames stored H labels for display", () => {
    const [fresh] = buildSiusFinalDetails("R3PM", [{ series: [104, 104, 51, 51, 10.2, 10.1] }]);
    expect(fresh.seriesLabels?.slice(4)).toEqual(["S1", "S2"]);
    const stored = { ...fresh, seriesLabels: ["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2", "H1", "H2"] };
    const [shown] = normalizeFinalDetailsForDisplay("R3PM", [stored]);
    expect(shown?.seriesLabels).toEqual(["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2", "S1", "S2"]);
  });
});
