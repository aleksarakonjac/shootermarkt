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

  it("labels air finals S1, S2 then single shots", () => {
    const [detail] = buildSiusFinalDetails("ARW", [{ series: [52.4, 51.9, 10.6] }]);
    expect(detail).toMatchObject({ cumulative: [52.4, 104.3, 114.9], seriesLabels: ["S1", "S2", "H1"] });
  });
});

describe("buildIssfFinalDetails", () => {
  it("keeps ISSF stage cumulatives as they are, with rank progression", () => {
    const [a, b] = buildIssfFinalDetails([{ stageCumulatives: [52.5, 104.5] }, { stageCumulatives: [53.0, 103.9] }]);
    expect(a).toEqual({ format: "bulletin", scoring: "decimal", cumulative: [52.5, 104.5], ranks: [2, 1] });
    expect(b).toMatchObject({ ranks: [1, 2] });
  });
});
