import { describe, expect, it } from "vitest";
import { startedCompetitions } from "./date-utils";

describe("startedCompetitions", () => {
  it("drops competitions that have not started and lists the newest first", () => {
    const list = [{ date: "2026-11-01" }, { date: "2026-12-05" }, { date: "2026-11-26" }, { date: "2026-11-27" }];
    expect(startedCompetitions(list, "2026-11-26")).toEqual([{ date: "2026-11-26" }, { date: "2026-11-01" }]);
  });
});
