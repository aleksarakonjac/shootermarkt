import { describe, expect, it } from "vitest";
import { alignTeamNumbers, linkTeamMembers, pairKey } from "./mixed-team-link";

const shooters = [
  { id: 1, firstName: "Damir", lastName: "MIKEC", nationality: "SRB" },
  { id: 2, firstName: "Tea", lastName: "MIKEC", nationality: "SRB" },
  { id: 3, firstName: "Petar", lastName: "GORSA", nationality: "CRO" },
];

describe("linkTeamMembers", () => {
  it("links both members found by exact name and nation", () => {
    expect(linkTeamMembers({ m_firstName: "Damir", m_lastName: "Mikec", f_firstName: "Tea", f_lastName: "Mikec" }, "SRB", shooters))
      .toEqual({ shooter1Id: 1, shooter2Id: 2 });
  });

  it("does not link a suggestion (a near spelling)", () => {
    expect(linkTeamMembers({ m_firstName: "Damier", m_lastName: "Mikec", f_firstName: "Tea", f_lastName: "Mikec" }, "SRB", shooters))
      .toEqual({ shooter1Id: null, shooter2Id: 2 });
  });

  it("does not link a Serbian team member to a shooter of another nation", () => {
    expect(linkTeamMembers({ m_firstName: "Petar", m_lastName: "Gorsa", f_firstName: "Tea", f_lastName: "Mikec" }, "SRB", shooters))
      .toEqual({ shooter1Id: null, shooter2Id: 2 });
  });

  it("does not link a shooter without a nation", () => {
    expect(linkTeamMembers({ m_firstName: "Ana", m_lastName: "Anic", f_firstName: "Tea", f_lastName: "Mikec" }, "SRB", [...shooters, { id: 4, firstName: "Ana", lastName: "ANIC", nationality: null }]))
      .toEqual({ shooter1Id: null, shooter2Id: 2 });
  });

  it("does not link the same name from another nation", () => {
    expect(linkTeamMembers({ m_firstName: "Damir", m_lastName: "Mikec", f_firstName: "Petar", f_lastName: "Gorsa" }, "CRO", shooters))
      .toEqual({ shooter1Id: null, shooter2Id: 3 });
  });

  it("links by ISSF id first and never to a namesake with another id", () => {
    const list = [
      { id: 1, firstName: "Pushpender", lastName: "SINGH", nationality: "IND", issfId: "SHINDM0206198601" },
      { id: 2, firstName: "Pushpender", lastName: "SINGH", nationality: "IND", issfId: "SHINDM2208200401" },
    ];
    const team = { m_firstName: "Pushpender", m_lastName: "Singh", mIssfId: "SHINDM2208200401", f_firstName: "Pushpender", f_lastName: "Singh", fIssfId: "SHINDM0101200901" };
    expect(linkTeamMembers(team, "IND", list)).toEqual({ shooter1Id: 2, shooter2Id: null });
  });

  it("does not link a junior team member to a namesake who is too old", () => {
    const list = [{ id: 1, firstName: "Damir", lastName: "MIKEC", nationality: "SRB", birthYear: 1984 }, { id: 2, firstName: "Tea", lastName: "MIKEC", nationality: "SRB", birthYear: 2007 }];
    expect(linkTeamMembers({ m_firstName: "Damir", m_lastName: "Mikec", f_firstName: "Tea", f_lastName: "Mikec" }, "SRB", list, { category: "junior", date: "2026-11-14" }))
      .toEqual({ shooter1Id: null, shooter2Id: 2 });
  });
});

describe("alignTeamNumbers", () => {
  const row = (teamNumber: number, shooter1Name: string | null, shooter2Name: string | null, ids: (number | null)[] = [], nocCode = "GEO") =>
    ({ nocCode, teamNumber, shooter1Name, shooter2Name, shooter1Id: ids[0] ?? null, shooter2Id: ids[1] ?? null });
  const a = (n: number, ids?: number[]) => row(n, "ABRAMISHVILI Mariam", "MOSULISHVILI Kako", ids);
  const b = (n: number, ids?: number[]) => row(n, "PRODIASHVILI Mariami", "KHVARESHIA Ioane", ids);
  const numbers = (incoming: Parameters<typeof alignTeamNumbers>[0], stored: Parameters<typeof alignTeamNumbers>[1]) =>
    alignTeamNumbers(incoming, stored).map((t) => t.teamNumber);

  it("keeps a pair on its number, whatever the order of teams, members or name parts", () => {
    expect(numbers([b(1), row(2, "Kako MOSULISHVILI", "Mariam Abramishvili")], [a(1), b(2)])).toEqual([2, 1]);
  });

  it("recognises a pair by one name, or by profiles when both are spelled differently", () => {
    expect(numbers([row(1, "PRODIASHVILI Mariami", "NOVI Nepoznat"), row(2, "ABRAMISHVILY M", "MOSULISHVILY K", [1, 2])], [a(1, [1, 2]), b(2)])).toEqual([2, 1]);
  });

  it("puts names before crossed profile links", () => {
    expect(numbers([a(2, [1, 2]), b(1, [3, 4])], [a(1, [3, 4]), b(2, [1, 2])])).toEqual([1, 2]);
  });

  it("gives an unknown pair the first free number when its own is another pair's", () => {
    expect(numbers([row(1, "NOVI Nepoznat", "NOVA Neznana")], [a(1), b(3)])).toEqual([2]);
    expect(numbers([a(2), row(1, "NOVI Nepoznat", "NOVA Neznana")], [a(1)])).toEqual([1, 2]);
  });

  it("numbers every nation on its own", () => {
    expect(numbers([row(1, "MIKEC Damir", "MIKEC Tea", [], "SRB")], [a(1)])).toEqual([1]);
  });

  it("keeps the source number for a team with no members, and takes a row with none", () => {
    expect(numbers([row(1, null, null)], [a(1)])).toEqual([1]);
    expect(numbers([a(1)], [row(1, null, null)])).toEqual([1]);
    // dva reda istog upisa nikad ne dobiju isti broj (upsert bi pao)
    expect(numbers([row(1, null, null), a(2)], [a(1)])).toEqual([2, 1]);
  });

  it("pairKey ignores member order and the team number", () => {
    expect(pairKey(a(1))).toBe(pairKey(row(2, "MOSULISHVILI Kako", "ABRAMISHVILI Mariam")));
    expect(pairKey(a(1))).not.toBe(pairKey(b(1)));
  });
});
