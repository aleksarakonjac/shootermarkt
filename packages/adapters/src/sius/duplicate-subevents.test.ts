import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLiveSiusResults, fetchSiusSubEventsAll } from "./public-adapter";

// Olympic Hopes (Šamorín): SIUS navodi isti pod-događaj dva puta. To nisu dve partije.
const SUBEVENTS = [
  { RunningId: "q", Name: "Qualification", State: "Finished", Hidden: false },
  { RunningId: "q", Name: "Qualification", State: "Finished", Hidden: false },
];
const athlete = (rank: number, name: string, inners: number) => ({
  Rank: { DisplayText: String(rank) }, DisplayName: name, Nation: "SVK",
  AthletesSeries: [{ TotalScore: 625.7, NumberOfInnerTen: inners, Series: [], AthleteIdentifier: { Identifier: name } }],
});
// Isti zbir: SIUS rangira po poslednjim serijama, ne po desetkama.
const SERIES = { "Series-Individual": [athlete(1, "ADAMOVIC Ana", 51), athlete(2, "VINTZE Vera", 53)] };
const EVENTS = [{ RunningId: "e", State: "Finished", Startdate: "2026-11-14T07:25:00+00:00", CompetitionEventType: { EventCode: "ARWJ", Name: "10m AIR RIFLE WOMEN JUNIOR" } }];

afterEach(() => vi.unstubAllGlobals());

function stubSius() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const body = url.includes("/subevents") ? SUBEVENTS : url.includes("/series") ? SERIES : EVENTS;
    return { ok: true, status: 200, json: async () => body };
  }));
}

describe("duplicated SIUS sub-events", () => {
  it("lists each sub-event once", async () => {
    stubSius();
    expect(await fetchSiusSubEventsAll("c", "e")).toHaveLength(1);
  });

  it("keeps the official ranks of tied totals", async () => {
    stubSius();
    const data = (await fetchLiveSiusResults("c", ["ARWJ"])).get("ARWJ")!;
    expect(data.qual.map((r) => [r.lastName, r.rank])).toEqual([["ADAMOVIC", 1], ["VINTZE", 2]]);
  });
});
