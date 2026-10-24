import { describe, expect, it } from "vitest";
import { assignSiusMatches, mixedTeamIdentity, parseSiusMatchKey, resolveTeamNoc, type SiusLiveData } from "./public-adapter";

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

describe("assignSiusMatches", () => {
  const row = (total: number) => ({ total }) as SiusLiveData["qual"][number];
  const data = (qual: number[], final: number[] = []): SiusLiveData => ({ qual: qual.map(row), elim: [], final: final.map(row) });

  it("keeps every repeated event as its own match, in date order (H&N: two individual days)", () => {
    const out = assignSiusMatches([
      { eventCode: "ARM", startDate: "2026-01-22T14:15:00+00:00", data: data([628], [251]) },
      { eventCode: "ARM", startDate: "2026-01-21T14:15:00+00:00", data: data([630], [252]) },
      { eventCode: "APM", startDate: "2026-01-21T08:00:00+00:00", data: data([580]) },
    ]);
    expect([...out.keys()].sort()).toEqual(["APM", "ARM", "ARM#2"]);
    expect(out.get("ARM")).toMatchObject({ match: 1, date: "2026-01-21", qual: [{ total: 630 }] });
    expect(out.get("ARM#2")).toMatchObject({ match: 2, date: "2026-01-22", qual: [{ total: 628 }] });
    expect(parseSiusMatchKey("ARM#2")).toEqual({ eventCode: "ARM", match: 2 });
  });

  it("an event without its own qualification continues the previous match", () => {
    const out = assignSiusMatches([
      { eventCode: "ARW", startDate: "2026-03-01T09:00:00+00:00", data: data([630]) },
      { eventCode: "ARW", startDate: "2026-03-01T12:00:00+00:00", data: data([], [252]) },
    ]);
    expect([...out.keys()]).toEqual(["ARW"]);
    expect(out.get("ARW")).toMatchObject({ qual: [{ total: 630 }], final: [{ total: 252 }] });
  });
});

describe("splitDisplayName", () => {
  it("treats the last word of an all-caps name as the first name", async () => {
    const { splitDisplayName } = await import("./public-adapter");
    expect(splitDisplayName("HEINRICH ALISON")).toEqual({ lastName: "HEINRICH", firstName: "ALISON" });
    expect(splitDisplayName("KOCHALUMKAL VINOD Vidarsa")).toEqual({ lastName: "KOCHALUMKAL VINOD", firstName: "Vidarsa" });
  });
});
