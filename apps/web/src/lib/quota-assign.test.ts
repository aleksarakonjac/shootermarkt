import { describe, expect, it } from "vitest";
import { assignQuotas, type QuotaCandidate } from "./quota-assign";

const c = (resultId: number, shooterId: number, nationality: string, rank: number): QuotaCandidate => ({ resultId, shooterId, nationality, rank });
const none = { shooterIds: new Set<number>(), eventNocs: new Set<string>(), nocCounts: new Map<string, number>() };

describe("assignQuotas", () => {
  it("takes the best-ranked candidates up to the number of places", () => {
    const won = assignQuotas({ ...none, places: 2, candidates: [c(3, 3, "CHN", 3), c(1, 1, "SRB", 1), c(2, 2, "IND", 2)] });
    expect(won.map((w) => w.resultId)).toEqual([1, 2]);
  });

  it("skips shooters who already hold a quota", () => {
    const won = assignQuotas({ ...none, places: 1, candidates: [c(1, 1, "SRB", 1), c(2, 2, "IND", 2)], shooterIds: new Set([1]) });
    expect(won.map((w) => w.resultId)).toEqual([2]);
  });

  it("gives a country only one quota per competition and discipline", () => {
    const won = assignQuotas({ ...none, places: 3, candidates: [c(1, 1, "CHN", 1), c(2, 2, "CHN", 2), c(3, 3, "IND", 3), c(4, 4, "SRB", 4)] });
    expect(won.map((w) => w.resultId)).toEqual([1, 3, 4]);
  });

  it("skips a country that already won a quota at this competition", () => {
    const won = assignQuotas({ ...none, places: 1, candidates: [c(1, 1, "CHN", 1), c(2, 2, "IND", 2)], eventNocs: new Set(["CHN"]) });
    expect(won.map((w) => w.resultId)).toEqual([2]);
  });

  it("skips a country at the cross-competition limit of 2", () => {
    const won = assignQuotas({ ...none, places: 2, candidates: [c(1, 1, "CHN", 1), c(2, 2, "IND", 2), c(3, 3, "SRB", 3)], nocCounts: new Map([["CHN", 2]]) });
    expect(won.map((w) => w.resultId)).toEqual([2, 3]);
  });

  it("works down a qualification ranking past shooters who already have quotas", () => {
    const quals = [c(1, 1, "CHN", 1), c(2, 2, "IND", 2), c(3, 3, "SRB", 3), c(4, 4, "CRO", 4)];
    const won = assignQuotas({ ...none, places: 1, candidates: quals, shooterIds: new Set([1, 2, 3]) });
    expect(won.map((w) => w.resultId)).toEqual([4]);
  });

  it("gives fewer quotas than places when nobody else is eligible", () => {
    expect(assignQuotas({ ...none, places: 3, candidates: [c(1, 1, "SRB", 1)] })).toHaveLength(1);
  });
});
