import { describe, expect, it } from "vitest";
import { matchShooter } from "./name-match";

const aleksandra = { id: 1, firstName: "Aleksandra", lastName: "Stojadinović", previousLastNames: ["Havran"] };

describe("matchShooter previous last names", () => {
  it("matches by current last name", () => {
    expect(matchShooter("Aleksandra", "Stojadinovic", "SRB", [aleksandra])).toEqual({ kind: "exact", id: 1 });
  });
  it("matches by previous last name", () => {
    expect(matchShooter("Aleksandra", "Havran", "SRB", [aleksandra])).toEqual({ kind: "exact", id: 1 });
  });
  it("does not match a different first name", () => {
    expect(matchShooter("Marija", "Havran", "SRB", [aleksandra]).kind).toBe("none");
  });
});

describe("matchShooter spelling variants (SIUS vs ISSF)", () => {
  const fiori = { id: 10, firstName: "Peter Matthew", lastName: "FIORI", nationality: "USA" };
  const weiss = { id: 11, firstName: "Simon", lastName: "WEISS", nationality: "GER" };
  const vidal = { id: 12, firstName: "Daniel Andres", lastName: "VIDAL MOLINA", nationality: "CHI" };
  const tan = { id: 13, firstName: "Fernel Qian Ni", lastName: "TAN", nationality: "SGP" };
  const buehl = { id: 14, firstName: "Hanna", lastName: "BUEHLMEYER", nationality: "GER" };
  const ana = { id: 15, firstName: "Anastasija", lastName: "Zivkovic", nationality: "SRB" };

  it("short first name, ß, Bavarian team code, short double surname, word order, umlaut", () => {
    expect(matchShooter("Peter", "FIORI", "USA", [fiori])).toEqual({ kind: "exact", id: 10 });
    expect(matchShooter("Simon", "WEIß", "BAY", [weiss])).toEqual({ kind: "exact", id: 11 });
    expect(matchShooter("Daniel", "VIDAL", "CHI", [vidal])).toEqual({ kind: "exact", id: 12 });
    expect(matchShooter("Qian Ni Fernel", "TAN", "SGP", [tan])).toEqual({ kind: "exact", id: 13 });
    expect(matchShooter("Hanna", "BÜHLMEYER", "GER", [buehl])).toEqual({ kind: "exact", id: 14 });
    expect(matchShooter("Małgorzata", "DĄBROWSKA", "POL", [{ id: 17, firstName: "Malgorzata", lastName: "DABROWSKA", nationality: "POL" }])).toEqual({ kind: "exact", id: 17 });
  });

  it("does not merge a different name that only shares letters, another country, or an ambiguous pair", () => {
    expect(matchShooter("Ana", "Zivkovic", "SRB", [ana]).kind).toBe("none");
    expect(matchShooter("Peter", "FIORI", "CAN", [fiori]).kind).toBe("none");
    const twoPeters = [fiori, { ...fiori, id: 16, firstName: "Peter James" }];
    expect(matchShooter("Peter", "FIORI", "USA", twoPeters).kind).toBe("suggestion");
  });

  it("an ambiguous variant resolves to the only candidate who has results", () => {
    const peters = [{ ...fiori, resultCount: 13 }, { ...fiori, id: 16, firstName: "Peter Louis", resultCount: 0 }];
    expect(matchShooter("Peter", "FIORI", "USA", peters)).toEqual({ kind: "exact", id: 10 });
  });
});
