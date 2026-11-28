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
  it("does not link a namesake too old for the category", () => {
    const senior = [{ id: 7, firstName: "Ana", lastName: "Petrović", nationality: "SRB", birthYear: 1975 }];
    const age = { category: "junior", date: "2026-11-27" };
    expect(matchMember({ firstName: "Ana", lastName: "Petrovic", teamNoc: "SRB" }, senior, age)).toEqual({ isNew: true });
  });
  it("only suggests a namesake whose nation is not the same", () => {
    const unknown = [{ id: 8, firstName: "Ana", lastName: "Petrović", nationality: null }];
    expect(matchMember({ firstName: "Ana", lastName: "Petrovic", teamNoc: "SRB" }, unknown)).toMatchObject({ isNew: true, suggestedShooterId: 8, suggestedName: "Ana Petrović" });
  });
  it("offers a close spelling as a suggestion for a new shooter", () => {
    expect(matchMember({ firstName: "Anna", lastName: "Petrovic", teamNoc: "SRB" }, shooters)).toMatchObject({ isNew: true, suggestedShooterId: 7 });
  });
});

describe("matchTeamMembers", () => {
  const member = { firstName: "Mila", lastName: "Ilic", teamNoc: "SRB", series: [], total: 600, inners: null };
  const team: TeamResultEntry = { skip: false, disciplineCode: "ARW", category: "senior", teamName: "Klub", rank: 1, total: 600, inners: null, members: [member] };

  it("gives a member the nation of its individual row", () => {
    const rows = [{ firstName: "Mila", lastName: "Ilic", teamNoc: "HUN", nationAssumed: true, isNew: true, disciplineCode: "ARW" }] as ReviewRow[];
    const { teamResults } = matchTeamMembers([team], [], rows, shooters);
    expect(teamResults[0].members[0]).toMatchObject({ teamNoc: "HUN", nationAssumed: true, isNew: true });
  });

  it("leaves a member with an individual row to be linked through that result", () => {
    // veza pojedinačnog reda (koju admin može i da promeni) važi pri upisu, ne ona iz parsiranja
    const rows = [{ firstName: "Ana", lastName: "Petrovic", teamNoc: "SRB", shooterId: 99, isNew: false, disciplineCode: "ARW" }] as ReviewRow[];
    const withAna = { ...team, members: [{ ...member, firstName: "Ana", lastName: "Petrovic" }] };
    const linked = matchTeamMembers([withAna], [], rows, shooters).teamResults[0].members[0];
    expect(linked.shooterId).toBeUndefined();
    expect(linked.isNew).toBe(false);
  });

  it("checks the age of a member against the day of the bulletin", () => {
    const senior = [{ id: 7, firstName: "Mila", lastName: "Ilic", nationality: "SRB", birthYear: 1975 }];
    const junior = { ...team, category: "junior" as const };
    expect(matchTeamMembers([junior], [], [], senior, "2026-11-27").teamResults[0].members[0]).toMatchObject({ isNew: true });
    expect(matchTeamMembers([junior], [], [], senior, "2026-11-27").teamResults[0].members[0].shooterId).toBeUndefined();
  });

  it("prepares mixed members to be created, man first, each with its own nation of a pair", () => {
    const pair = { nocCode: "SRB/HUN", mFirstName: "Ana", mLastName: "Petrovic", fFirstName: "Mila", fLastName: "Ilic" } as MixedTeamEntry;
    const [entry] = matchTeamMembers([], [pair], [], shooters).mixed;
    expect(entry).toMatchObject({ createMissing: true, mShooterId: 7, mIsNew: false, mGender: "M", fIsNew: true, fGender: "F" });
  });
});
