import { describe, expect, it } from "vitest";
import { pickMemberShooter, teamDiff } from "./team-member-link";

const individuals = [{ shooterId: 7, firstName: "Ana", lastName: "Test" }];
const m = { firstName: "Ana", lastName: "TEST" };

describe("pickMemberShooter", () => {
  it("keeps an existing link over everything", () => expect(pickMemberShooter({ ...m, shooterId: 9 }, 3, individuals)).toBe(3));
  it("takes the reviewed shooter before the name match", () => expect(pickMemberShooter({ ...m, shooterId: 9 }, null, individuals)).toBe(9));
  it("links by the individual result of the competition", () => expect(pickMemberShooter(m, null, individuals)).toBe(7));
  it("accepts the same shooter listed in two categories", () => expect(pickMemberShooter(m, null, [...individuals, ...individuals])).toBe(7));
  it("does not guess between two namesakes", () => expect(pickMemberShooter(m, null, [...individuals, { shooterId: 8, firstName: "Ana", lastName: "Test" }])).toBeNull());
});

describe("teamDiff", () => {
  const old = { rank: 1, total: "1865.2", inners: null, remark: null, members: [{ name: "Test Ana", series: [100.1], total: "625.3", inners: null, shooterId: 3 }] };
  const next = { rank: 1, total: 1865.2, inners: null, remark: null, members: [{ name: "Test Ana", series: [100.1], total: 625.3, inners: null, shooterId: 3 }] };

  it("sees a re-import of the same team as unchanged", () => expect(teamDiff(old, next)).toEqual([]));
  it("ignores a link the preview does not know yet", () => expect(teamDiff(old, { ...next, members: [{ ...next.members[0], shooterId: null }] })).toEqual([]));
  it("reports a new placement and a new line-up", () => {
    expect(teamDiff(old, { ...next, rank: 2 })).toEqual(["plasman"]);
    expect(teamDiff(old, { ...next, members: [] })).toEqual(["sastav"]);
    expect(teamDiff({ ...old, members: [{ ...old.members[0], shooterId: null }] }, next)).toEqual(["sastav"]);
  });
});
