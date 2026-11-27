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
});
