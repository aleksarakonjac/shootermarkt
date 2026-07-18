import { describe, expect, it } from "vitest";
import { selectTickerUpcoming } from "./homepage-data";

describe("selectTickerUpcoming", () => {
  it("keeps only the next two weeks, or falls back to the next three competitions", () => {
    const near = [{ date: "2026-07-20" }, { date: "2026-08-01" }, { date: "2026-08-02" }];
    expect(selectTickerUpcoming(near, "2026-07-18").map(({ date }) => date)).toEqual(["2026-07-20", "2026-08-01"]);
    expect(selectTickerUpcoming([{ date: "2026-08-03" }, { date: "2026-08-04" }, { date: "2026-08-05" }, { date: "2026-08-06" }], "2026-07-18").map(({ date }) => date)).toEqual(["2026-08-03", "2026-08-04", "2026-08-05"]);
  });
});
