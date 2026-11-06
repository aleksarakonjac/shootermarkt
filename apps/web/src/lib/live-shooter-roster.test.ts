import { describe, expect, it, vi } from "vitest";
import { matchShooter } from "@shootermarkt/db/name-match";
import { createShooterRoster, type RosterQueries, type RosterShooter } from "./live-shooter-roster";

const shooter = (id: number, firstName: string, lastName: string, nationality: string, issfId: string | null = null): RosterShooter => ({ id, firstName, lastName, nationality, issfId });

const queries = (nationRows: RosterShooter[] = [], lastNameRows: RosterShooter[] = []) => ({
  byNationalities: vi.fn<RosterQueries["byNationalities"]>(async () => nationRows),
  byFoldedLastName: vi.fn<RosterQueries["byFoldedLastName"]>(async () => lastNameRows),
  byIssfId: vi.fn<RosterQueries["byIssfId"]>(async () => undefined),
});

describe("createShooterRoster", () => {
  it("resolves an exact known name without loading more shooters", async () => {
    const q = queries();
    const roster = createShooterRoster([shooter(1, "Ana", "Petrovic", "SRB")], q);
    expect(await roster.match("Ana", "Petrović", "SRB")).toEqual({ kind: "exact", id: 1 });
    expect(q.byNationalities).not.toHaveBeenCalled();
    expect(q.byFoldedLastName).not.toHaveBeenCalled();
  });

  it("prefers the exact shooter outside known over a prefix variant inside known", async () => {
    const ana = shooter(1, "Ana", "Petrovic", "SRB");
    const anaMarija = shooter(2, "Ana Marija", "Petrovic", "SRB");
    const roster = createShooterRoster([ana], queries([ana, anaMarija], [ana, anaMarija]));
    expect(await roster.match("Ana Marija", "Petrovic", "SRB")).toEqual({ kind: "exact", id: 2 });
  });

  it("keeps a variant unique when the same shooter comes from known and nation rows", async () => {
    const peter = shooter(1, "Peter Matthew", "Fiori", "USA");
    const roster = createShooterRoster([peter], queries([peter]));
    expect(await roster.match("Peter", "Fiori", "USA")).toEqual({ kind: "exact", id: 1 });
  });

  it("gives the same answer as matching against the whole table", async () => {
    const all = [shooter(1, "Max", "Weiss", "GER"), shooter(2, "Max", "Weiß", "BAY"), shooter(3, "Ivan", "Horvat", "CRO")];
    const q = queries(all.slice(0, 2), [all[0]]);
    const roster = createShooterRoster([], q);
    expect(await roster.match("Ivan", "Weiss", "GER")).toEqual(matchShooter("Ivan", "Weiss", "GER", all.slice(0, 2)));
    expect(q.byNationalities).toHaveBeenCalledWith(["GER", "BAY"]);
  });

  it("loads each nation once per run", async () => {
    const q = queries();
    const roster = createShooterRoster([], q);
    await roster.match("A", "One", "USA");
    await roster.match("B", "Two", "USA");
    expect(q.byNationalities).toHaveBeenCalledTimes(1);
  });

  it("uses the ISSF id before the name and sees shooters added during the run", async () => {
    const q = queries();
    const roster = createShooterRoster([shooter(1, "Other", "Name", "SRB", "123")], q);
    expect(await roster.matchIssf("123", "Ana", "Petrovic", "SRB")).toBe(1);
    roster.add(shooter(2, "New", "Athlete", "USA"));
    expect(await roster.match("New", "Athlete", "USA")).toEqual({ kind: "exact", id: 2 });
  });
});
