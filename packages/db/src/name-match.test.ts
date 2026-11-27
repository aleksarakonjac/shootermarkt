import { describe, expect, it } from "vitest";
import { matchAthlete, matchShooter } from "./name-match";

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
    expect(matchShooter("YI", "HO XIU", "SGP", [{ id: 18, firstName: "Xiu Yi", lastName: "HO", nationality: "SGP" }])).toEqual({ kind: "exact", id: 18 });
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

  it("remembered first-name variants from merges match exactly", () => {
    const mariam = { id: 20, firstName: "Mariami", lastName: "PRANGISHVILI", previousFirstNames: ["Mariam"], nationality: "GEO" };
    expect(matchShooter("Mariam", "PRANGISHVILI", "GEO", [mariam])).toEqual({ kind: "exact", id: 20 });
  });
});

describe("matchAthlete (ISSF ID odlučuje)", () => {
  const namesake = { id: 1, firstName: "Pushpender", lastName: "SINGH", nationality: "IND", issfId: "SHINDM0206198601" };
  const junior = { id: 2, firstName: "Pushpender", lastName: "SINGH", nationality: "IND", issfId: "SHINDM2208200401" };
  const unlinked = { id: 3, firstName: "Pushpender", lastName: "SINGH", nationality: "IND", issfId: null };

  it("bira strelca sa istim ID-em umesto prvog imenjaka", () => {
    expect(matchAthlete("SHINDM2208200401", "Pushpender", "Singh", "IND", [namesake, junior])).toEqual({ kind: "exact", id: 2 });
  });

  it("ne vezuje za imenjaka sa drugim ID-em", () => {
    expect(matchAthlete("SHINDM2208200401", "Pushpender", "Singh", "IND", [namesake])).toEqual({ kind: "none" });
  });

  it("po imenu prihvata strelca bez ISSF ID-a", () => {
    expect(matchAthlete("SHINDM2208200401", "Pushpender", "Singh", "IND", [namesake, unlinked])).toEqual({ kind: "exact", id: 3 });
  });

  it("bez ISSF ID-a (ili uz lokalni SIUS broj) poklapa po imenu kao i do sada", () => {
    expect(matchAthlete(null, "Pushpender", "Singh", "IND", [namesake])).toEqual({ kind: "exact", id: 1 });
    expect(matchAthlete("S35/21945", "Pushpender", "Singh", "IND", [namesake])).toEqual({ kind: "exact", id: 1 });
  });
});

describe("uzrasna granica pri poklapanju po imenu", () => {
  const born = (id: number, birthYear: number | null, issfId: string | null = null) => ({ id, firstName: "Pavel", lastName: "HRABALIK", nationality: "CZE", birthYear, issfId });
  const match = (candidates: ReturnType<typeof born>[], category: string, id: string | null = null) =>
    matchAthlete(id, "Pavel", "Hrabalik", "CZE", candidates, { age: { category, date: "2026-11-14" } });

  it("preskače prestarog imenjaka i uzima mlađeg ili onog bez godišta", () => {
    expect(match([born(1, 1981)], "kadet")).toEqual({ kind: "none" });
    expect(match([born(1, 1981), born(2, null)], "kadet")).toEqual({ kind: "exact", id: 2 });
    expect(match([born(1, 1981), born(3, 2011)], "kadet")).toEqual({ kind: "exact", id: 3 });
  });

  it("granica po kategoriji je uključiva: U16 16, U18 18, junior 21", () => {
    for (const [category, max] of [["kadet", 16], ["mladji_junior", 18], ["junior", 21]] as const) {
      expect(match([born(1, 2026 - max)], category)).toEqual({ kind: "exact", id: 1 });
      expect(match([born(1, 2026 - max - 1)], category)).toEqual({ kind: "none" });
    }
  });

  it("seniori i nepoznat datum nemaju granicu", () => {
    expect(match([born(1, 1981)], "senior")).toEqual({ kind: "exact", id: 1 });
    expect(matchShooter("Pavel", "Hrabalik", "CZE", [born(1, 1981)], { age: { category: "kadet", date: null } })).toEqual({ kind: "exact", id: 1 });
  });

  it("isti ISSF ID pobeđuje i kad godište odudara", () => {
    expect(match([born(1, 1981, "SHCZEM1710198101")], "kadet", "SHCZEM1710198101")).toEqual({ kind: "exact", id: 1 });
  });
});
