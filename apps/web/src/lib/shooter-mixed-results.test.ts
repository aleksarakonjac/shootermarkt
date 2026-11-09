import { describe, expect, it } from "vitest";
import { mergeCompetitionIds, partnerShortName, toMixedHistoryRow, type MixedRowInput } from "./shooter-mixed-results";

const COMP = {
  competitionId: 3, competitionName: "EP U23 Vroclav", competitionDate: "2026-08-03", competitionDateEnd: "2026-08-09",
  competitionLocation: "Wroclaw", competitionCountry: "Poljska", competitionCountryCode2: "PL",
};
const BASE: MixedRowInput = {
  id: 5, shooter1Id: 10, shooter2Id: null, shooter1Name: "RAKONJAC Aleksa", shooter2Name: "PETROVIĆ Žaklina",
  qualTotal: "629.1", qualInners: null, qualRank: 6, qualified: false, finalRank: null, finalTotal: null,
  shooter1Detail: { series: [105.1], total: 315.2 }, shooter2Detail: { series: [104.9], total: 313.9 },
  shooter1FirstName: "Aleksa", shooter1LastName: "Rakonjac", shooter2FirstName: null, shooter2LastName: null,
  disciplineCode: "ARMT", category: "senior", ...COMP,
};

describe("toMixedHistoryRow", () => {
  it("builds a mixed history row with the partner from the unlinked slot name", () => {
    const row = toMixedHistoryRow(BASE, 10);
    expect(row).toMatchObject({ rowKey: "m:5", kind: "mixed", partnerName: "Ž. Petrović", qualTotal: "629.1", qualRank: 6, disciplineCode: "ARMT", competitionId: 3 });
    expect(row.mixedDetail?.own?.total).toBe(315.2);
    expect(row.mixedDetail?.partner?.total).toBe(313.9);
    expect(row.elimTotal).toBeNull();
  });

  it("uses the linked partner's name when the shooter is in slot 2", () => {
    const row = toMixedHistoryRow({ ...BASE, shooter1Id: 11, shooter2Id: 10, shooter1FirstName: "Marko", shooter1LastName: "Ivić" }, 10);
    expect(row.partnerName).toBe("M. Ivić");
    expect(row.mixedDetail?.own?.total).toBe(313.9);
  });
});

describe("toMixedHistoryRow inners", () => {
  it("keeps APMT team inners — they break qualification ties", () => {
    const row = toMixedHistoryRow({ ...BASE, disciplineCode: "APMT", qualTotal: "571", qualInners: 14 }, 10);
    expect(row.qualInners).toBe(14);
  });
});

describe("partnerShortName", () => {
  it("shortens SIUS display names and linked names", () => {
    expect(partnerShortName(null, null, "KOCHALUMKAL VINOD Vidarsa")).toBe("V. Kochalumkal Vinod");
    expect(partnerShortName("Žaklina", "Petrović", "ignored")).toBe("Ž. Petrović");
    expect(partnerShortName(null, null, null)).toBeNull();
    expect(partnerShortName("Islam", "SATPAYEV", null)).toBe("I. Satpayev");
  });
});

describe("mergeCompetitionIds", () => {
  it("keeps competitions that only have a mixed team result", () => {
    const merged = mergeCompetitionIds(
      [{ id: 1, date: "2026-05-01" }],
      [{ id: 2, date: "2026-06-01" }, { id: 1, date: "2026-05-01" }],
      5,
    );
    expect(merged).toEqual([{ id: 2, date: "2026-06-01" }, { id: 1, date: "2026-05-01" }]);
  });

  it("sorts by date then id descending and keeps limit + 1 for the next cursor", () => {
    const merged = mergeCompetitionIds([{ id: 1, date: "2026-01-01" }, { id: 4, date: "2026-03-01" }], [{ id: 3, date: "2026-03-01" }], 1);
    expect(merged).toEqual([{ id: 4, date: "2026-03-01" }, { id: 3, date: "2026-03-01" }]);
  });
});
