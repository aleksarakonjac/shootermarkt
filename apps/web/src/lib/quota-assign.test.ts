import { describe, expect, it } from "vitest";
import { assignQuotas, candidateRank, maxQuotasPerNocAtEvent, meetsMqs, type QuotaCandidate } from "./quota-assign";

const c = (resultId: number, shooterId: number, nationality: string, rank: number): QuotaCandidate => ({ resultId, shooterId, nationality, rank });
const none = { shooterIds: new Set<number>(), eventNocCounts: new Map<string, number>(), maxPerNocAtEvent: 1, nocCounts: new Map<string, number>() };

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
    const won = assignQuotas({ ...none, places: 1, candidates: [c(1, 1, "CHN", 1), c(2, 2, "IND", 2)], eventNocCounts: new Map([["CHN", 1]]) });
    expect(won.map((w) => w.resultId)).toEqual([2]);
  });

  it("allows two quotas for a country at a non-championship competition", () => {
    const won = assignQuotas({ ...none, maxPerNocAtEvent: 2, places: 3, candidates: [c(1, 1, "CHN", 1), c(2, 2, "CHN", 2), c(3, 3, "CHN", 3), c(4, 4, "IND", 4)] });
    expect(won.map((w) => w.resultId)).toEqual([1, 2, 4]);
  });

  it("skips candidates below the MQS or without a qualification score", () => {
    const won = assignQuotas({ ...none, places: 2, minScore: 613, candidates: [{ ...c(1, 1, "CHN", 1), qualTotal: 612.9 }, { ...c(2, 2, "IND", 2), qualTotal: null }, { ...c(3, 3, "SRB", 3), qualTotal: 613 }, { ...c(4, 4, "CRO", 4), qualTotal: 630.1 }] });
    expect(won.map((w) => w.resultId)).toEqual([3, 4]);
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

describe("maxQuotasPerNocAtEvent / meetsMqs", () => {
  it("allows 1 at a world championship and 2 elsewhere", () => {
    expect(maxQuotasPerNocAtEvent("world", "championship")).toBe(1);
    expect(maxQuotasPerNocAtEvent("world", "world_cup")).toBe(2);
    expect(maxQuotasPerNocAtEvent("continental", "championship")).toBe(2);
  });

  it("checks the minimum qualification score per discipline", () => {
    expect(meetsMqs("ARM", 613.0)).toBe(true);
    expect(meetsMqs("ARM", 612.9)).toBe(false);
    expect(meetsMqs("APW", 560)).toBe(true);
    expect(meetsMqs("APW", null)).toBe(false);
    expect(meetsMqs("XXX", null)).toBe(true);
  });
});

describe("candidateRank", () => {
  it("ranks finalists first, then non-finalists by qualification rank", () => {
    expect(candidateRank("final", 3, 20)).toBe(3);
    expect(candidateRank("final", null, 9)).toBe(1009);
    expect(candidateRank("final", null, null)).toBeNull();
    expect(candidateRank("final", 8, 4)! < candidateRank("final", null, 1)!).toBe(true);
  });

  it("uses only the qualification rank for qualification-based allocations", () => {
    expect(candidateRank("qualification", 1, 12)).toBe(12);
  });

  it("falls through to the next qualifier when every finalist is ineligible", () => {
    const eligible = assignQuotas({
      ...{ shooterIds: new Set([1, 2]), eventNocCounts: new Map<string, number>(), maxPerNocAtEvent: 1, nocCounts: new Map<string, number>() },
      places: 1,
      candidates: [
        { resultId: 1, shooterId: 1, nationality: "CHN", rank: candidateRank("final", 1, 1)! },
        { resultId: 2, shooterId: 2, nationality: "IND", rank: candidateRank("final", 2, 2)! },
        { resultId: 3, shooterId: 3, nationality: "SRB", rank: candidateRank("final", null, 9)! },
        { resultId: 4, shooterId: 4, nationality: "CRO", rank: candidateRank("final", null, 10)! },
      ],
    });
    expect(eligible.map((w) => w.resultId)).toEqual([3]);
  });
});
