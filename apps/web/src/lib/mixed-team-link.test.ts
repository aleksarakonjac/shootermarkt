import { describe, expect, it } from "vitest";
import { linkTeamMembers } from "./mixed-team-link";

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
