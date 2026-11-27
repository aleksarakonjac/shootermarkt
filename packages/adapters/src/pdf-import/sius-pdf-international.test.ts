import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { foldName } from "@shootermarkt/db/name-match";
import { mergeFinalsIntoRows, type ParsedFinalResult, type ParsedShooterResult, type ReviewRow } from "@shootermarkt/db/pdf-import-types";
import { parseSiusPdf, splitGuessedName } from "./sius-pdf";
import { resolveGuessedNames } from "./sius-names";

// Međunarodni SIUS format, PDF presložen Ghostscript-om (fontovi bez mape slova).
const fixture = readFileSync(new URL("./__fixtures__/sius-salona-dc-open-2026.pdf", import.meta.url));

describe("parseSiusPdf — Salona Trophy + DC Open 2026", async () => {
  const bilten = (await parseSiusPdf(fixture))!;
  const quals = bilten.events.filter((e) => e.stage === "qualification");
  const list = (discipline: string, category: string, eventName: string | null) =>
    quals.find((e) => e.discipline === discipline && e.category === category && e.eventName === eventName)!.results as ParsedShooterResult[];
  const DC = "Salona DC Open 2026";

  it("reads every individual list in full, with the Trophy as main match and DC Open as its own", () => {
    // brojevi su "Number of athletes on this list" iz podnožja svake liste
    expect(quals.map((e) => `${e.discipline}/${e.category}/${e.eventName ?? "-"}:${e.results.length}`).sort()).toEqual([
      `APM/junior/-:24`, `APM/senior/-:77`, `APM/senior/${DC}:51`,
      `APW/junior/-:29`, `APW/senior/-:53`, `APW/senior/${DC}:34`,
      `ARM/junior/-:44`, `ARM/senior/-:75`, `ARM/senior/${DC}:58`,
      `ARW/junior/-:44`, `ARW/senior/-:65`, `ARW/senior/${DC}:56`,
      `FPM/senior/-:2`,
    ].sort());
    expect(bilten.hasFinals).toBe(false);
  });

  it("restores Croatian and other letters the PDF lost", () => {
    const names = quals.flatMap((e) => (e.results as ParsedShooterResult[]).map((r) => `${r.lastName} ${r.firstName}`));
    expect(names.filter((n) => !/^[\p{L}' .-]+$/u.test(n))).toEqual([]);
    expect(names).toEqual(expect.arrayContaining(["Gorša Petar", "Tadić Toma", "Maričić Miran", "Posavec Željko", "Đurik Luka"]));
  });

  it("reads nation from the club column and never invents clubs from it", () => {
    expect(list("APM", "senior", DC)[1]).toMatchObject({ rank: 2, lastName: "Mikec", firstName: "Damir", teamNoc: "SRB", total: 576, inners: 17, clubName: undefined });
    expect(list("ARM", "senior", null)[0]).toMatchObject({ rank: 1, lastName: "Gorša", teamNoc: "CRO", total: 631.7, qualified: true });
    expect(list("ARW", "senior", DC)[0]).toMatchObject({ rank: 1, lastName: "Ponjavić", firstName: "Emilija", teamNoc: "SRB", total: 632.1 });
  });

  it("reads a nation written in mixed case", () => {
    const all = quals.flatMap((e) => e.results as ParsedShooterResult[]);
    expect(all.find((r) => r.lastName === "Hujdur")!.teamNoc).toBe("BIH");
    expect(all.filter((r) => r.teamNoc === "SRB").every((r) => !r.clubName)).toBe(true);
  });

  const teams = (code: string) => bilten.mixedTeams!.filter((t) => t.disciplineCode === code);

  it("reads every mixed team with both shooters, and the medal finals", () => {
    expect([teams("ARMT").length, teams("APMT").length]).toEqual([19, 17]);
    expect(bilten.warnings ?? []).toEqual([]);
    expect(teams("APMT").find((t) => t.nocCode === "SRB")).toMatchObject({
      qualRank: 2, qualTotal: 572, inners: 21, qualified: true, finalRank: 1, finalTotal: 475.7,
      mLastName: "Mikec", mFirstName: "Damir", m_series: [100, 96, 98], mTotal: 294, mInners: 16,
      fLastName: "Mikec", fFirstName: "Tea", f_series: [96, 89, 93], fTotal: 278,
      mFinalSeries: [50.6, 50.3, 48.9, 31.2, 30.4, 28.3],
    });
    expect(teams("ARMT").filter((t) => t.finalRank != null).map((t) => [t.finalRank, t.finalTotal, t.nocCode]).sort()).toEqual([
      [1, 499, "CRO"], [2, 495.9, "CRO"], [3, 433.4, "CRO"], [4, 367, "CRO"],
    ]);
  });

  it("numbers teams of one nation and finds the nation of a team printed without it", () => {
    for (const code of ["ARMT", "APMT"]) {
      const keys = teams(code).map((t) => `${t.nocCode}#${t.teamNumber}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(teams("APMT").find((t) => t.qualRank === 13)!.nocCode).toBe("SLO");
  });

  it("every series adds up to the total", () => {
    const wrong = quals.flatMap((e) => e.results as ParsedShooterResult[])
      .filter((r) => r.total != null && Math.abs(r.series.reduce((a, b) => a + b, 0) - r.total) > 0.05);
    expect(wrong).toEqual([]);
  });

  it("reads the four DC Open finals and matches all finalists", () => {
    const finals = bilten.events.filter((e) => e.stage === "final");
    expect(finals.map((e) => `${e.discipline}:${e.eventName}:${e.results.length}`).sort()).toEqual([`APM:${DC}:8`, `APW:${DC}:8`, `ARM:${DC}:8`, `ARW:${DC}:8`]);
    expect((finals.find((e) => e.discipline === "ARM")!.results as ParsedFinalResult[])[0]).toMatchObject({ lastName: "Tomašević", firstName: "Darko", teamNoc: "CRO", total: 252.1 });
    const rows = quals.flatMap((e) => (e.results as ParsedShooterResult[]).map((r): ReviewRow => ({
      firstName: r.firstName, lastName: r.lastName, teamNoc: r.teamNoc, disciplineCode: e.discipline, category: e.category,
      eventName: e.eventName, qualTotal: r.total,
    })));
    expect(mergeFinalsIntoRows(rows, bilten.events, foldName)).toMatchObject({ matchedFinals: 32, unmatchedFinals: 0 });
  });
});

describe("resolveGuessedNames on the Salona bulletin", () => {
  it("joins two surnames of a listed shooter even when neither is known", async () => {
    const parsed = (await parseSiusPdf(fixture))!;
    resolveGuessedNames(parsed, [{ firstName: "Ivana", lastName: "X" }, { firstName: "Franko", lastName: "Y" }]);
    const names = parsed.events.flatMap((e) => (e.results as ParsedShooterResult[]).map((r) => `${r.lastName}|${r.firstName}`));
    expect(names).toEqual(expect.arrayContaining(["Čapeta Rakić|Ivana", "Novak Mesar|Franko", "Reić|Ivan Vid", "Tucker|Mary Carolynn"]));
  });
});

describe("splitGuessedName", () => {
  const first = new Set(["ivana", "marija", "sasa", "valentina", "tea", "elena", "ivan", "vid", "mary", "adnan"]);
  const split = (full: string) => splitGuessedName(full, (word) => first.has(word.toLowerCase()));

  it("keeps two surnames together when the middle word is not a first name", () => {
    expect(split("Čapeta Rakić Ivana")).toEqual({ lastName: "Čapeta Rakić", firstName: "Ivana" });
    expect(split("Siladjev Kinkela Marija")).toEqual({ lastName: "Siladjev Kinkela", firstName: "Marija" });
  });

  it("keeps two first names together", () => {
    expect(split("Reić Ivan Vid")).toEqual({ lastName: "Reić", firstName: "Ivan Vid" });
    expect(split("Tucker Mary Carolynn")).toEqual({ lastName: "Tucker", firstName: "Mary Carolynn" });
  });

  it("treats the last word as the first name when nothing is known", () => {
    expect(split("Novak Mesar Franko")).toEqual({ lastName: "Novak Mesar", firstName: "Franko" });
  });
});
