import { describe, expect, it } from "vitest";
import { matchesSearch, nocKeywords } from "./ResultSearch";

describe("matchesSearch", () => {
  it("matches name tokens in any order, ignoring case and diacritics", () => {
    expect(matchesSearch("djordjevic mil", "Miloš", "ĐORĐEVIĆ", "SRB")).toBe(true);
    expect(matchesSearch("petrovic", "Miloš", "ĐORĐEVIĆ")).toBe(false);
    expect(matchesSearch("  ", "x")).toBe(true);
  });
  it("matches nation by NOC, Serbian and English name", () => {
    for (const q of ["srb", "srbija", "serbia"]) expect(matchesSearch(q, "Ana", nocKeywords("SRB"))).toBe(true);
    expect(matchesSearch("hrvatska", nocKeywords("SRB"))).toBe(false);
  });
});
