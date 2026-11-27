import { describe, expect, it } from "vitest";
import type { MixedTeamEntry, ReviewRow, TeamResultEntry } from "@shootermarkt/db/pdf-import-types";
import { matchMember, matchTeamMembers } from "./team-members";

const shooters = [{ id: 7, firstName: "Ana", lastName: "Petrović", nationality: "SRB", resultCount: 3 }];

describe("matchMember", () => {
  it("links an exact name of the same nation", () => {
    expect(matchMember({ firstName: "Ana", lastName: "Petrovic", teamNoc: "SRB" }, shooters)).toEqual({ shooterId: 7, isNew: false });
  });
  it("marks an unknown shooter as new", () => {
    expect(matchMember({ firstName: "Mila", lastName: "Ilic", teamNoc: "SRB" }, shooters)).toEqual({ isNew: true });
  });
  it("offers a close spelling as a suggestion for a new shooter", () => {
    expect(matchMember({ firstName: "Anna", lastName: "Petrovic", teamNoc: "SRB" }, shooters)).toMatchObject({ isNew: true, suggestedShooterId: 7 });
  });
});

describe("matchTeamMembers", () => {
  const member = { firstName: "Mila", lastName: "Ilic", teamNoc: "SRB", series: [], total: 600, inners: null };
  const team: TeamResultEntry = { skip: false, disciplineCode: "ARW", category: "senior", teamName: "Klub", rank: 1, total: 600, inners: null, members: [member] };

  it("gives a member the nation of its individual row", () => {
    const rows = [{ firstName: "Mila", lastName: "Ilic", teamNoc: "HUN", nationAssumed: true }] as ReviewRow[];
    const { teamResults } = matchTeamMembers([team], [], rows, shooters);
    expect(teamResults[0].members[0]).toMatchObject({ teamNoc: "HUN", nationAssumed: true, isNew: true });
  });

  it("prepares mixed members to be created, man first, each with its own nation of a pair", () => {
    const pair = { nocCode: "SRB/HUN", mFirstName: "Ana", mLastName: "Petrovic", fFirstName: "Mila", fLastName: "Ilic" } as MixedTeamEntry;
    const [entry] = matchTeamMembers([], [pair], [], shooters).mixed;
    expect(entry).toMatchObject({ createMissing: true, mShooterId: 7, mIsNew: false, mGender: "M", fIsNew: true, fGender: "F" });
  });
});
