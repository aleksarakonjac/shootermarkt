import { describe, expect, it } from "vitest";
import type { MixedTeamEntry, TeamMemberEntry, TeamResultEntry } from "@shootermarkt/db/pdf-import-types";
import { applyMemberPatch, memberRows } from "./teamMemberRows";

const member = (over: Partial<TeamMemberEntry> = {}): TeamMemberEntry => ({ firstName: "Mila", lastName: "Test", teamNoc: "SRB", series: [], total: 600, inners: null, isNew: true, ...over });
const team = (members: TeamMemberEntry[], over: Partial<TeamResultEntry> = {}): TeamResultEntry => ({ skip: false, disciplineCode: "ARW", category: "senior", teamName: "Klub", rank: 1, total: 600, inners: null, members, ...over });
const pair = { skip: false, nocCode: "SRB", teamNumber: 1, disciplineCode: "ARMT", mLastName: "Ilic", mFirstName: "Ana", fLastName: "Ilic", fFirstName: "Marko", mIsNew: true, fIsNew: true, mGender: "M", fGender: "F" } as MixedTeamEntry;

describe("memberRows", () => {
  it("lists club members first, then mixed members, leaving out skipped teams", () => {
    const rows = memberRows([team([member()]), team([member({ lastName: "Skip" })], { skip: true })], [pair]);
    expect(rows.map((r) => [r.lastName, r.firstName, r.disciplineCode, r.gender, r.isNew])).toEqual([
      ["Test", "Mila", "ARW", "F", true], ["Ilic", "Ana", "ARMT", "M", true], ["Ilic", "Marko", "ARMT", "F", true]]);
  });
});

describe("applyMemberPatch", () => {
  it("renames a shooter in the team list together with the individual row", () => {
    const next = applyMemberPatch([team([member()])], [], 0, { lastName: "Testić" });
    expect(next.teamResults[0].members[0].lastName).toBe("Testić");
  });

  it("confirming a suggestion sets the member's shooter", () => {
    const next = applyMemberPatch([team([member({ suggestedShooterId: 5 })])], [], 0, { shooterId: 5, isNew: false, suggestedShooterId: undefined });
    expect(next.teamResults[0].members[0]).toMatchObject({ shooterId: 5, isNew: false, suggestedShooterId: undefined });
  });

  it("skips over skipped teams when addressing a member", () => {
    const next = applyMemberPatch([team([member()], { skip: true }), team([member({ lastName: "Drugi" })])], [], 0, { firstName: "Nova" });
    expect(next.teamResults[1].members[0].firstName).toBe("Nova");
    expect(next.teamResults[0].members[0].firstName).toBe("Mila");
  });

  it("addresses mixed members by m and f, and keeps a pair's two nations", () => {
    expect(applyMemberPatch([], [pair], 1, { gender: "M" }).mixed[0]).toMatchObject({ fGender: "M", mGender: "M" });
    expect(applyMemberPatch([team([member()])], [pair], 1, { shooterId: 9, isNew: false }).mixed[0]).toMatchObject({ mShooterId: 9, mIsNew: false });
    expect(applyMemberPatch([], [pair], 1, { teamNoc: "HUN" }).mixed[0].nocCode).toBe("SRB/HUN");
  });
});
