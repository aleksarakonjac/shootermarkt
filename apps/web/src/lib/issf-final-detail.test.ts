import { describe, expect, it } from "vitest";
import { buildIssfFinalDetails } from "./issf-final-detail";

const five = (v: number) => [v, v, v, v, v];

describe("buildIssfFinalDetails", () => {
  it("maps a 10m air final to the ar_ap_10m layout and marks eliminations", () => {
    const winner = { shotsByStage: [five(10.5), five(10.4), [10.6, 10.2], [10.9, 10.1]], stageCumulatives: [52.5, 104.5, 125.3, 146.3], total: 146.3 };
    const eighth = { shotsByStage: [five(10.0), five(10.0), [9.9, 9.8]], stageCumulatives: [50, 100, 119.7], total: 119.7 };
    const [a, b] = buildIssfFinalDetails("ARW", [winner, eighth]);

    expect(a).toEqual({ format: "ar_ap_10m", phase1: { series: [five(10.5), five(10.4)], subtotal: 104.5 }, phase2: { shots: [10.6, 10.2, 10.9, 10.1], eliminatedAfterShot: null }, total: 146.3 });
    expect(b).toMatchObject({ format: "ar_ap_10m", phase2: { shots: [9.9, 9.8], eliminatedAfterShot: 2 } });
  });

  it("keeps a 3-position final as per-stage totals, not a flat shot list", () => {
    const stages = [five(10.2), five(10.4), five(10.1)];
    const [detail] = buildIssfFinalDetails("R3PM", [{ shotsByStage: stages, stageCumulatives: [51, 103, 153.5], total: 153.5 }]);

    expect(detail).toMatchObject({ format: "bulletin", scoring: "decimal", series: [51, 52, 50.5], cumulative: [51, 103, 153.5] });
    expect(detail).not.toHaveProperty("shots");
  });

  it("falls back to per-stage totals when an air final does not have the 5+5 opening", () => {
    const [detail] = buildIssfFinalDetails("APM", [{ shotsByStage: [[10, 9.8], [10.1]], stageCumulatives: [19.8, 29.9], total: 29.9 }]);
    expect(detail).toMatchObject({ format: "bulletin", scoring: "decimal", series: [19.8, 10.1] });
  });
});
