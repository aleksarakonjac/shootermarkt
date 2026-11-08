import { describe, expect, it } from "vitest";
import type { SiusEscSoloAthlete } from "@shootermarkt/adapters/sius/public-adapter";
import { escSoloReviewRows } from "./sius-merge";

const ALEKSA: SiusEscSoloAthlete = {
  siusAthleteId: "a1", firstName: "Aleksa", lastName: "RAKONJAC", nation: "SRB",
  part1: { series: [9, 9, 8], total: 26, rank: 4, remark: "Q" },
  part2: { series: [9, 8, 9, 7, 9, 10], total: 52, rank: 1, remark: "QG" },
  match: { total: 10, rank: 2, series: [2, 2, 2, 2, 2], opponentTotal: 12, opponentName: "LINDGREN Victor", shootOff: null },
  qualified: true,
};
const OUT_IN_K1: SiusEscSoloAthlete = {
  siusAthleteId: "b1", firstName: "Petar", lastName: "PETROVIC", nation: "SRB",
  part1: { series: [9, 9, 9], total: 27, rank: 20, remark: null },
  part2: null, match: null, qualified: false,
};

describe("escSoloReviewRows", () => {
  it("maps Solo phases into qualification and final columns, never elimination", () => {
    const rows = escSoloReviewRows([ALEKSA, OUT_IN_K1], "SOLOARM", "senior", () => 7);
    expect(rows[0]).toMatchObject({
      disciplineCode: "SOLOARM", qualTotal: 52, qualRank: 1, qualified: true, remark: null,
      finalTotal: 10, finalRank: 2, finalScoring: "hit_count", finalSeries: [2, 2, 2, 2, 2],
      finalOpponentTotal: 12, finalOpponentName: "LINDGREN Victor", shooterId: 7,
    });
    expect(rows[0].elimTotal).toBeUndefined();
    expect(rows[0].elimRound).toBeUndefined();
    expect(rows[0].qualEscSolo?.part2?.total).toBe(52);
    expect(rows[1]).toMatchObject({ qualTotal: 27, qualRank: 20, qualified: false, finalTotal: null });
    expect(rows[1].qualEscSolo).toEqual({ format: "esc_solo", part1: OUT_IN_K1.part1 });
  });

  it("keeps the shoot-off mark of a tied medal match", () => {
    const tied = { ...ALEKSA, match: { ...ALEKSA.match!, total: 12, rank: 1, shootOff: "SO" } };
    const [row] = escSoloReviewRows([tied], "SOLOARM", "senior", () => undefined);
    expect(row.remarkDetails?.final?.shootOff).toBe("SO");
    expect(row.warning).toBeDefined();
  });
});
