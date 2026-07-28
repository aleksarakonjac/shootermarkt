import { describe, expect, it } from "vitest";
import { mixedTeamIdentity, resolveTeamNoc } from "./public-adapter";

describe("resolveTeamNoc", () => {
  it("uses the members' current competition NOC over a stale team federation", () => {
    expect(resolveTeamNoc("RUS", [{ nation: "AIN" }, { nation: "AIN" }])).toBe("AIN");
  });

  it("keeps the team NOC when members do not agree", () => {
    expect(resolveTeamNoc("SRB", [{ nation: "SRB" }, { nation: "AIN" }])).toBe("SRB");
  });
});

describe("mixedTeamIdentity", () => {
  it("keeps four AIN teams distinct when their source labels reuse team numbers", () => {
    const teams = [
      ["SHRUSW1010200701", "SHRUSM1102199901"],
      ["SHBLRW01012000", "SHBLRM01012000"],
      ["SHBLRW02022000", "SHBLRM02022000"],
      ["SHRUSW03032000", "SHRUSM03032000"],
    ];
    const keys = teams.map(([siusAthleteId, partnerId]) => mixedTeamIdentity([
      { siusAthleteId, firstName: "A", lastName: "A" },
      { siusAthleteId: partnerId, firstName: "B", lastName: "B" },
    ]));

    expect(new Set(keys)).toHaveLength(4);
  });
});
