import { describe, expect, it } from "vitest";
import { deriveFinalRankProgression } from "./final-rank-progression";

describe("deriveFinalRankProgression", () => {
  it("ranks each available cumulative final score against the other finalists", () => {
    expect(deriveFinalRankProgression(
      [50, 100, 150],
      [[50, 100, 150], [52, 98, 151], [48, 101, 149]],
    )).toEqual([2, 2, 2]);
  });
});
