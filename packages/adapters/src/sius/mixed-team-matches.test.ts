import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLiveSiusMixedTeamResults } from "./public-adapter";

// Takmičenje sa ARMT dva dana: svaki dan je svoj meč sa svojim datumom.
const EVENTS = [
  { RunningId: "e2", State: "Finished", Startdate: "2026-10-24T09:00:00+02:00", CompetitionEventType: { EventCode: "ARMT", Name: "10m AIR RIFLE MIXED TEAM - 2" } },
  { RunningId: "e1", State: "Finished", Startdate: "2026-10-23T14:00:00+02:00", CompetitionEventType: { EventCode: "ARMT", Name: "10m AIR RIFLE MIXED TEAM" } },
];
const SUBEVENTS = [{ RunningId: "q", Name: "Qualification", State: "Finished", Hidden: false }];
const athlete = (name: string, total: number) => ({ DisplayName: name, Nation: "SRB", TotalScore: total, Series: [], AthleteIdentifier: { Identifier: name } });
const SERIES = { "Series-TeamOfIndividuals": [{ Rank: { DisplayText: "1" }, Nation: "SRB", Result: { Value: "628.3", Extensions: [] }, AthletesSeries: [athlete("MIKEC Damir", 315.3), athlete("MIKEC Tea", 313.0)] }] };

afterEach(() => vi.unstubAllGlobals());

describe("fetchLiveSiusMixedTeamResults", () => {
  it("gives every match of a discipline its date and the number of matches", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const body = url.includes("/subevents") ? SUBEVENTS : url.includes("/series") ? SERIES : EVENTS;
      return { ok: true, status: 200, json: async () => body };
    }));
    const out = await fetchLiveSiusMixedTeamResults("c", ["ARMT"]);
    expect([...out.keys()].sort()).toEqual(["ARMT", "ARMT#2"]);
    expect(out.get("ARMT")).toMatchObject({ date: "2026-10-23", matchCount: 2 });
    expect(out.get("ARMT#2")).toMatchObject({ date: "2026-10-24", matchCount: 2 });
  });
});
