import { describe, expect, it } from "vitest";
import { buildIssfFinalDetails, buildSiusFinalDetails } from "./final-detail";

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
    expect(detail).toMatchObject({ cumulative: [104.3, 209.2, 260.4, 311.2, 321.7, 331.8], seriesLabels: ["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2", "H1", "H2"] });
  });

  it("groups SIUS per-shot values by the 3P plan when the API returns single shots", () => {
    const [detail] = buildSiusFinalDetails("R3PW", [{ series: [...shots(10, 10.4), ...shots(10, 10.5), ...shots(5, 10.1), ...shots(5, 10.2), 10.7] }]);
    expect(detail).toMatchObject({ cumulative: [104, 209, 259.5, 310.5, 321.2], seriesLabels: ["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2", "H1"] });
  });

  it("labels air finals S1, S2 then single shots", () => {
    const [detail] = buildSiusFinalDetails("ARW", [{ series: [52.4, 51.9, 10.6] }]);
    expect(detail).toMatchObject({ cumulative: [52.4, 104.3, 114.9], seriesLabels: ["S1", "S2", "H1"] });
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
      seriesLabels: ["Klečeći", "Ležeći", "Stojeći 1", "Stojeći 2", "H1", "H2"],
    });
  });

  it("regroups ISSF air shots into 5+5 then single shots, with a partial series while live", () => {
    const [done, live] = buildIssfFinalDetails("APW", [
      { stageCumulatives: [], shotsByStage: [shots(5, 10), shots(5, 9.8), [10.4]], total: 109.4 },
      { stageCumulatives: [], shotsByStage: [shots(3, 10)], total: 30 },
    ]);
    expect(done).toMatchObject({ cumulative: [50, 99, 109.4], seriesLabels: ["S1", "S2", "H1"] });
    expect(live).toMatchObject({ cumulative: [30] });
  });

  it("keeps ISSF stage cumulatives (F1…) when individual shots are not available", () => {
    const [a, b] = buildIssfFinalDetails("ARW", [{ stageCumulatives: [52.5, 104.5], shotsByStage: [], total: 104.5 }, { stageCumulatives: [53.0, 103.9], shotsByStage: [], total: 103.9 }]);
    expect(a).toEqual({ format: "bulletin", scoring: "decimal", cumulative: [52.5, 104.5], ranks: [2, 1] });
    expect(b).toMatchObject({ ranks: [1, 2] });
  });
});
