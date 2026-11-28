import { describe, expect, it } from "vitest";
import { attachTeams, teamNoc, type CompetitionTeam } from "./competition-teams";
import type { DisciplineGroup } from "@/app/(site)/[locale]/(public)/[scope]/takmicenja/[id]/CompetitionResultsClient";

const team = (over: Partial<CompetitionTeam> = {}): CompetitionTeam => ({
  id: 1, teamName: "Klub", rank: 1, total: "1691.0", inners: 32, remark: null, members: [],
  disciplineCode: "APM", disciplineName: "Vazdušni pištolj", apparatus: "air_pistol", category: "senior", competitionEventId: null, eventName: null, eventDate: null, ...over,
});
const group = (over: Partial<DisciplineGroup> = {}): DisciplineGroup => ({
  id: "APM", key: "APM", code: "APM", name: "Vazdušni pištolj", eventName: null, label: null, date: null, apparatus: "air_pistol",
  categories: [{ category: "senior", results: [] }], ...over,
});

describe("attachTeams", () => {
  it("puts teams into the block and category of their shooters", () => {
    const out = attachTeams([group()], [team(), team({ id: 2, category: "junior" })], "sr");
    expect(out).toHaveLength(1);
    expect(out[0].categories.map((c) => [c.category, c.teams?.map((t) => t.id)])).toEqual([["senior", [1]], ["junior", [2]]]);
  });

  it("finds the block of a discipline split by match", () => {
    const split = [group({ id: "APM|senior" }), group({ id: "APM@4|senior", key: "APM@4", eventName: "2. meč · 28.11." })];
    const out = attachTeams(split, [team({ competitionEventId: 4, eventName: "2. meč · 28.11." })], "sr");
    expect(out[0].categories[0].teams).toBeUndefined();
    expect(out[1].categories[0].teams).toHaveLength(1);
  });

  it("creates a block when only team results exist", () => {
    const out = attachTeams([], [team(), team({ id: 2, competitionEventId: 4, eventName: "2. meč · 28.11.", eventDate: "2026-11-28" })], "sr");
    expect(out.map((g) => [g.id, g.key, g.date, g.categories[0].teams?.length])).toEqual([["APM", "APM", null, 1], ["APM@4|senior", "APM@4", "2026-11-28", 1]]);
    expect(out[1].label).toContain("2. meč");
  });

  it("does not change the groups it was given", () => {
    const original = group();
    attachTeams([original], [team()], "sr");
    expect(original.categories[0].teams).toBeUndefined();
  });
});

describe("teamNoc", () => {
  const members = (...nocs: (string | null)[]) => nocs.map((nationality) => ({ shooterId: null, name: "X", nationality, series: [], total: "0", inners: null }));

  it("reads the country from a national team name, in either language", () => {
    expect(["France", "Bugarska", "Serbia 2", "AIN"].map((teamName) => teamNoc({ teamName, members: [] }))).toEqual(["FRA", "BUL", "SRB", "AIN"]);
  });

  it("uses the shooters' country for a club only when all of them share a known one", () => {
    const club = (...nocs: (string | null)[]) => teamNoc({ teamName: "Pancevo 1813", members: members(...nocs) });
    expect(club("SRB", "SRB", "SRB")).toBe("SRB");
    expect(club("RUS", "BLR")).toBe("AIN");
    expect(club("SRB", "HUN")).toBeNull();
    expect(club("SRB", null)).toBeNull();
    expect(club()).toBeNull();
  });
});
