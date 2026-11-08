import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./__fixtures__/esc-solo-arm-vroclav.json";
import { escSoloCodeFromEvent, fetchSiusEscSoloResults, mergeEscSoloPhases, type SiusLiveResult } from "./public-adapter";

const COMP = "6d8a4737-458e-4b5e-8f01-f878cdadcda0";
const EVENT = "2667e9c9-3fdb-4081-bfdf-85b3738b9515";
const SUB = {
  "76875d2d-87a2-441f-ada4-8f7520888440": fixture.part1,
  "2835ac8e-b61a-441f-86ac-47637d63f374": fixture.part2,
  "f608999c-e191-4ec3-a928-6c2cfee7a361": fixture.gold,
  "923776f9-f39f-4533-a6e4-61053d4a74d5": fixture.bronze,
} as Record<string, unknown>;

function stubSius() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const body = url.includes("/subevents") ? fixture.subevents : SUB[new URL(url).searchParams.get("subEventId") ?? ""];
    return { ok: body !== undefined, status: body ? 200 : 404, json: async () => body };
  }));
}
afterEach(() => vi.unstubAllGlobals());

const row = (lastName: string, over: Partial<SiusLiveResult> = {}): SiusLiveResult => ({
  rank: 1, displayName: `${lastName} X`, firstName: "X", lastName, nation: "SRB", total: 20, inners: 56,
  series: [7, 7, 6], siusAthleteId: `id-${lastName}`, qualified: false, remark: null,
  penalty: null, shootOff: null, record: null, ...over,
});

describe("escSoloCodeFromEvent", () => {
  it("maps ESC Solo event codes", () => {
    expect(escSoloCodeFromEvent("ARM-ECH-SOLO")).toBe("SOLOARM");
    expect(escSoloCodeFromEvent("APW-ECH-SOLO")).toBe("SOLOAPW");
    expect(escSoloCodeFromEvent("ARM")).toBeNull();
  });
});

describe("fetchSiusEscSoloResults", () => {
  it("merges Vroclav Solo phases per athlete", async () => {
    stubSius();
    const rows = await fetchSiusEscSoloResults(COMP, EVENT);
    expect(rows).toHaveLength(31);
    const aleksa = rows.find((r) => r.lastName === "RAKONJAC")!;
    expect(aleksa.part2).toMatchObject({ total: 52, rank: 1, remark: "QG" });
    expect(aleksa.match).toMatchObject({ total: 10, rank: 2, opponentTotal: 12, opponentName: "LINDGREN Victor" });
    expect(aleksa.part1.series).toHaveLength(3);
    expect(rows.filter((r) => r.part2).length).toBe(18);
    expect(rows.filter((r) => r.match).length).toBe(4);
    expect(rows.find((r) => r.lastName === "BUHAITSEV")!.match).toMatchObject({ rank: 3, total: 11, opponentTotal: 9 });
    const out = rows.find((r) => !r.part2)!;
    expect(out.part1.total).toBeLessThanOrEqual(30);
    expect(out.part1.rank).toBeGreaterThan(18);
  });
});

describe("mergeEscSoloPhases", () => {
  it("takes match rank from SIUS on a tie and keeps the shoot-off mark", () => {
    const merged = mergeEscSoloPhases({
      part1: [row("A"), row("B", { rank: 2 })], part2: [],
      gold: [row("A", { total: 12, rank: 2 }), row("B", { total: 12, rank: 1, shootOff: "SO" })], bronze: [],
    });
    expect(merged.find((r) => r.lastName === "B")!.match).toMatchObject({ rank: 1, shootOff: "SO" });
    expect(merged.find((r) => r.lastName === "A")!.match).toMatchObject({ rank: 2, opponentTotal: 12 });
  });

  it("keeps a DNS athlete with null totals and drops inner tens", () => {
    const [dns] = mergeEscSoloPhases({ part1: [row("A", { rank: null, total: 0, remark: "DNS" })], part2: [], gold: [], bronze: [] });
    expect(dns.part1).toEqual({ series: [7, 7, 6], total: null, rank: null, remark: "DNS" });
    expect(dns.match).toBeNull();
    expect(dns.qualified).toBe(false);
  });
});
