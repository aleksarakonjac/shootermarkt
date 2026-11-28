import { describe, expect, it, vi } from "vitest";
vi.mock("@shootermarkt/db", () => ({ db: {} }));
import { toTeamHistoryRow, type TeamHistoryInput } from "./shooter-team-results";

const input: TeamHistoryInput = {
  id: 3, teamName: "Pancevo 1813", rank: 1, total: "1691.0", inners: 32, remark: null, disciplineCode: "APM", category: "junior",
  competitionId: 5, competitionName: "Youth Cup", competitionDate: "2026-11-27", competitionDateEnd: "2026-11-29", competitionLocation: "Smederevo",
  competitionCountry: "Srbija", competitionCountryCode2: "RS", competitionEventId: null, eventName: null, eventDate: null,
  members: [{ shooterId: 7, name: "Ninkovic Velimir", firstName: "Velimir", lastName: "NINKOVIĆ", series: [93, 97], total: "565.0", inners: 15 }, { shooterId: null, name: "Kondic Jovan", series: [], total: "565.0", inners: 8 }],
};

describe("toTeamHistoryRow", () => {
  it("shows the team's placement and total with every member", () => {
    expect(toTeamHistoryRow(input)).toMatchObject({
      rowKey: "t:3", kind: "team", teamName: "Pancevo 1813", qualRank: 1, qualTotal: "1691.0", qualInners: 32,
      competitionDate: "2026-11-27", competitionDateEnd: "2026-11-29", disciplineCode: "APM", category: "junior",
      teamMembers: [{ shooterId: 7, name: "Velimir Ninković", total: 565, inners: 15 }, { shooterId: null, name: "Jovan Kondic" }],
    });
  });

  it("takes the date of its own match", () => {
    expect(toTeamHistoryRow({ ...input, competitionEventId: 4, eventName: "2. meč · 28.11.", eventDate: "2026-11-28" }))
      .toMatchObject({ competitionDate: "2026-11-28", competitionDateEnd: null, competitionEventId: 4, eventName: "2. meč · 28.11." });
  });
});
