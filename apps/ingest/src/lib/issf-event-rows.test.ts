import { beforeEach, describe, expect, it, vi } from "vitest";
import * as issf from "@shootermarkt/adapters/issf/adapter";
import { buildIssfEventRows } from "./issf-event-rows";

vi.mock("@shootermarkt/adapters/issf/adapter", () => ({
  fetchQualResultsFromHtml: vi.fn(),
  fetchR3PResultsFromHtml: vi.fn(),
  fetchElimResultsFromHtml: vi.fn(),
  fetchFinalResultsFromHtml: vi.fn(),
}));

type Event = Parameters<typeof buildIssfEventRows>[1];
const phase = (title: string) => ({ title, resultKey: title, startDateTime: "", pdfResultLink: null });
const position = { series: [[97, 96]], total: 193 };
const athlete = (issfId: string, total: number, rank = 1) => ({
  rank, issfId, lastName: issfId, firstName: "A", nationCode: "ARG", total, inners: 20, qualified: false, remark: null,
});
const threeP = (issfId: string, total: number, rank = 1) => ({ ...athlete(issfId, total, rank), kneeling: position, prone: position, standing: position });
const event = (titles: { qual?: string; elim?: string[]; final?: string }): Event => ({
  disciplineCode: "R3PM",
  category: "senior",
  qualPhase: titles.qual ? phase(titles.qual) : null,
  finalPhase: titles.final ? phase(titles.final) : null,
  elimPhases: (titles.elim ?? []).map((title, i) => ({ round: i + 1, phase: phase(title) })),
});
const build = (e: Event) => buildIssfEventRows(1, e, () => undefined);

beforeEach(() => vi.resetAllMocks());

describe("buildIssfEventRows, 3 positions", () => {
  it("imports the qualification when there are no eliminations", async () => {
    vi.mocked(issf.fetchR3PResultsFromHtml).mockResolvedValue([threeP("SH1", 590)]);

    await expect(build(event({ qual: "Qualification" }))).resolves.toMatchObject([
      { issfId: "SH1", qualTotal: 590, qualRank: 1, qualPositions: { prone: position } },
    ]);
  });

  it("keeps eliminations apart from the qualification and adds the final", async () => {
    vi.mocked(issf.fetchR3PResultsFromHtml).mockResolvedValue([threeP("SH1", 590)]);
    vi.mocked(issf.fetchElimResultsFromHtml).mockImplementation(async (_id, key) =>
      key === "Elimination Relay 1"
        ? [{ ...athlete("SH1", 580), series: [97, 96] }]
        : [{ ...athlete("SH2", 560, 9), series: [90, 91] }]);
    vi.mocked(issf.fetchFinalResultsFromHtml).mockResolvedValue([
      { rank: 2, issfId: "SH1", lastName: "SH1", firstName: "A", nationCode: "ARG", stageCumulatives: [150.1], total: 450.2, shotsByStage: [[10.1]], shootOff: false },
    ]);

    const rows = await build(event({ qual: "Qualification", elim: ["Elimination Relay 1", "Elimination Relay 2"], final: "Final" }));

    expect(rows).toMatchObject([
      { issfId: "SH1", qualTotal: 590, elimRound: 1, elimTotal: 580, elimSeries: [97, 96], finalRank: 2, finalTotal: 450.2 },
      { issfId: "SH2", qualTotal: null, elimRound: 2, elimTotal: 560, elimRank: 9 },
    ]);
    expect(rows[1].qualRank).toBeUndefined();
  });

  it("merges qualification relays into one ranking", async () => {
    vi.mocked(issf.fetchR3PResultsFromHtml).mockImplementation(async (_id, key) =>
      [key === "Qualification Relay 1" ? threeP("SH1", 570) : threeP("SH2", 580)]);

    await expect(build(event({ qual: "Qualification Relay 1", elim: ["Qualification Relay 1", "Qualification Relay 2"] }))).resolves.toMatchObject([
      { issfId: "SH2", qualRank: 1 },
      { issfId: "SH1", qualRank: 2 },
    ]);
    expect(issf.fetchElimResultsFromHtml).not.toHaveBeenCalled();
  });
});
