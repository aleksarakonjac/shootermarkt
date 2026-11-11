import { describe, expect, it } from "vitest";
import { serbianAccusative } from "./sr-accusative";

describe("serbianAccusative", () => {
  it.each([
    ["Srbija", "Srbiju"],
    ["Indija", "Indiju"],
    ["Slovačka", "Slovačku"],
    ["Kina", "Kinu"],
    ["Bosna i Hercegovina", "Bosnu i Hercegovinu"],
    ["Crna Gora", "Crnu Goru"],
    ["Južna Koreja", "Južnu Koreju"],
    ["Dominikanska Republika", "Dominikansku Republiku"],
    ["Papua Nova Gvineja", "Papuu Novu Gvineju"],
  ])("feminine %s → %s", (nominative, accusative) => expect(serbianAccusative(nominative)).toBe(accusative));

  it.each(["Egipat", "Japan", "Novi Zeland", "Ujedinjeno Kraljevstvo", "Sjedinjene Države", "Ujedinjeni Arapski Emirati", "Komorska Ostrva", "Filipini", "Meksiko"])(
    "keeps %s",
    (name) => expect(serbianAccusative(name)).toBe(name),
  );

  it("drops a parenthetical alias", () => expect(serbianAccusative("Mijanmar (Burma)")).toBe("Mijanmar"));
});
