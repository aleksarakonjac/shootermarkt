import { describe, expect, it } from "vitest";
import type { ParsedShooterResult } from "@shootermarkt/db/pdf-import-types";
import { parseSiusPages } from "./sius-pdf";
import { resolveNations } from "./sius-nations";
import { resolveGuessedNames } from "./sius-names";

/** Minimalna SIUS rang lista: po jedan red za svaki par [ime, NOC/klub]. */
function bilten(rows: [string, string][]) {
  return parseSiusPages([[
    { x: 178, y: 811, str: "XXII. Hungarian Open" }, { x: 270, y: 795, str: "RESULTS" },
    { x: 55, y: 684, str: "Rank" }, { x: 100, y: 684, str: "Bib No" }, { x: 133, y: 684, str: "Name" }, { x: 230, y: 684, str: "NOC" },
    { x: 363, y: 676, str: "1" },
    ...rows.flatMap(([name, club], i) => {
      const y = 663 - i * 15;
      return [
        { x: 72, y, str: String(i + 1) }, { x: 105, y, str: String(1000 + i) }, { x: 132, y, str: name },
        { x: 229, y, str: club }, { x: 349, y, str: "104.3" }, { x: 522, y, str: "104.3" },
      ];
    }),
    { x: 52, y: 98, str: "Q100000IA1911260825.1.ARM.0.001.pdf" },
  ]])!;
}

function resolve(rows: [string, string][], known: { firstName: string; lastName: string; nationality: string }[]) {
  const parsed = bilten(rows);
  resolveNations(parsed, known);
  return (parsed.events[0].results as ParsedShooterResult[]).map((r) => [r.lastName, r.teamNoc, r.clubName ?? null, !!r.nationAssumed]);
}

const peni = { firstName: "István", lastName: "Péni", nationality: "HUN" };

describe("resolveNations — strani bilten", () => {
  it("takes the nation from the database, then from a plain country code, else assumes the host and flags it", () => {
    expect(resolve([
      ["PÉNI István", "UTE"],
      ["JAUHIAINEN Vertti", "FIN"],
      ["TICHÝ Radek", "CZE-DUK"],
      ["WITTMANN Péter", "APLE"],
      ["OVIEDO Jesús", "UTE"],
    ], [peni, { firstName: "Jesús", lastName: "Oviedo", nationality: "ESP" }])).toEqual([
      ["Péni", "HUN", "UTE", false],
      ["Jauhiainen", "FIN", null, false],
      ["Tichý", "CZE", null, false],
      ["Wittmann", "HUN", "APLE", true],
      ["Oviedo", "ESP", "UTE", false],
    ]);
  });

  it("leaves the nation empty and flagged when the host cannot be told", () => {
    expect(resolve([["TICHÝ Radek", "CZE-DUK"], ["WITTMANN Péter", "APLE"]], [])).toEqual([
      ["Tichý", "CZE", null, false],
      ["Wittmann", "", "APLE", true],
    ]);
  });

  it("does not guess between namesakes from different countries", () => {
    expect(resolve([["PÉNI István", "UTE"], ["SOMOGYI Péter", "ZTE"], ["TICHÝ Radek", "CZE-DUK"]], [
      peni,
      { firstName: "Péter", lastName: "Somogyi", nationality: "AUT" },
      { firstName: "Péter", lastName: "Somogyi", nationality: "SVK" },
    ])[1]).toEqual(["Somogyi", "HUN", "ZTE", true]);
  });

  it("leaves a domestic bulletin untouched", () => {
    expect(resolve([["JOVANOVIC Stevan", "CIKA MATA"], ["PETROVIC Marko", "NOVI SAD"], ["GEORGIEV Ivan", "SVETKAVITSA - BUL"]], [
      { firstName: "Stevan", lastName: "Jovanovic", nationality: "SRB" },
    ])).toEqual([
      ["Jovanovic", "SRB", "CIKA MATA", false],
      ["Petrovic", "SRB", "NOVI SAD", false],
      ["Georgiev", "BUL", "SVETKAVITSA", false],
    ]);
  });
});

/** Minimalna SIUS lista mešovitih timova: po tim [naziv, prvi strelac, drugi strelac]. */
function teamPage(file: string, teams: [string, string, string][]) {
  return [
    { x: 55, y: 684, str: "Rank" }, { x: 100, y: 684, str: "Bib No Name" }, { x: 363, y: 676, str: "1" },
    ...teams.flatMap(([label, m, f], i) => {
      const y = 663 - i * 45;
      const athlete = (name: string, bib: number, row: number) => [
        { x: 103, y: row, str: String(bib) }, { x: 130, y: row, str: name }, { x: 363, y: row, str: "104.0" }, { x: 522, y: row, str: "104.0" },
      ];
      return [{ x: 72, y, str: String(i + 1) }, { x: 103, y, str: label }, { x: 522, y, str: "208.0" },
        ...athlete(m, 100 + i * 2, y - 15), ...athlete(f, 101 + i * 2, y - 30)];
    }),
    { x: 52, y: 98, str: file },
  ];
}

describe("resolveNations — mešoviti timovi", () => {
  const teamsOf = (parsed: ReturnType<typeof bilten>) =>
    parsed.mixedTeams!.map((t) => [t.category, t.nocCode, t.teamNumber, !!t.nationAssumed]);

  it("reads junior mixed teams (ARMTJ) beside the senior ones", () => {
    const parsed = parseSiusPages([
      teamPage("Q100000TA1911261000.1.ARMT.0.001.pdf", [["HUN-UTE 1", "PENI Istvan", "MESZAROS Eszter"]]),
      teamPage("Q100000TA1911261200.1.ARMTJ.0.001.pdf", [["HUN-UTE 1", "WITTMANN Peter", "KISS Anna"]]),
    ])!;
    expect(teamsOf(parsed)).toEqual([["senior", "HUN", 1, false], ["junior", "HUN", 1, false]]);
  });

  it("takes a team nation from the database, then a plain code, else the host, and renumbers per nation", () => {
    const parsed = parseSiusPages([teamPage("Q100000TA1911261000.1.ARMT.0.001.pdf", [
      ["CZE-DUK 1", "TICHY Radek", "NOVA Jana"],
      ["UTE 1", "PENI Istvan", "MESZAROS Eszter"],
      ["APLE 1", "WITTMANN Peter", "KISS Anna"],
      ["FIN 1", "JAUHIAINEN Vertti", "AALTO Aino"],
      ["ZTE 1", "OVIEDO Jesus", "GARCIA Maria"],
    ])])!;
    resolveNations(parsed, [
      { firstName: "Istvan", lastName: "Peni", nationality: "HUN" },
      { firstName: "Jesus", lastName: "Oviedo", nationality: "ESP" },
    ]);
    expect(teamsOf(parsed)).toEqual([
      ["senior", "CZE", 1, false],
      ["senior", "HUN", 1, false],
      ["senior", "HUN", 2, true],
      ["senior", "FIN", 1, false],
      ["senior", "ESP", 1, false],
    ]);
  });

  it("leaves domestic teams as SRB", () => {
    const parsed = parseSiusPages([teamPage("Q100000TA1910261000.1.ARMT.0.001.pdf", [
      ["CIKA MATA 1", "JOVANOVIC Stevan", "PETROVIC Ana"],
      ["NOVI SAD 1", "ILIC Marko", "MARIC Iva"],
    ])])!;
    resolveNations(parsed, []);
    expect(teamsOf(parsed)).toEqual([["senior", "SRB", 1, false], ["senior", "SRB", 2, false]]);
  });
});

describe("mešoviti timovi — oblici sa pravih lista", () => {
  const qualFile = "Q200000TA2011261655.1.ARMT.0.001.pdf";
  const finalPage = (teams: [string, string, string][]) => [
    ...teamPage("F200000TA2011261815.1.ARMT.0.001.pdf", teams).filter((it) => it.str !== "Rank" && !(it.y === 676 && it.str === "1")),
    { x: 55, y: 684, str: "Rk" }, { x: 300, y: 684, str: "Stage 1" },
  ];

  it("skips unranked DNS teams instead of dropping the whole page", () => {
    const dns = (y: number, bib = 900) => [
      { x: 130, y, str: "PVSK 3" }, { x: 560, y, str: "DNS" },
      { x: 103, y: y - 15, str: String(bib) }, { x: 130, y: y - 15, str: "BONDICZ Emilia" }, { x: 522, y: y - 15, str: "304.9" },
      { x: 103, y: y - 30, str: String(bib + 1) }, { x: 130, y: y - 30, str: "SZEKERES Nimrod" }, { x: 560, y: y - 30, str: "DNS" },
    ];
    const parsed = parseSiusPages([
      [...teamPage(qualFile, [["ZTE", "SELEK Reka", "KOVACS Peter"]]), ...dns(560)],
      [...teamPage(qualFile, []), ...dns(663, 910)],
    ])!;
    expect(parsed.mixedTeams!.map((t) => [t.qualRank, t.qualTotal, t.qualRemark ?? null, t.mLastName, t.mTotal, t.fTotal])).toEqual([
      [1, 208, null, "Selek", 104, 104],
      [null, null, "DNS", "Bondicz", 304.9, 0],
      [null, null, "DNS", "Bondicz", 304.9, 0],
    ]);
    expect(parsed.mixedTeams!.map((t) => t.qualified)).toEqual([false, false, false]);
    expect(parsed.warnings).toBeUndefined();
  });

  it("joins the final to the qualification by bib numbers when the final abbreviates names", () => {
    const parsed = parseSiusPages([
      teamPage(qualFile, [["UTE 1", "DENES Eszter", "PENI Istvan Marton"]]),
      finalPage([["UTE 1 - UTE", "DENES Eszter", "PENI I."]]),
    ])!;
    expect(parsed.mixedTeams!.map((t) => [t.qualRank, t.finalRank, t.fFirstName])).toEqual([[1, 1, "Istvan Marton"]]);
  });

  it("does not read a repeated club name as a country", () => {
    const parsed = parseSiusPages([finalPage([["UTE - UTE", "DENES Eszter", "PENI Istvan"], ["CZE-DUK 2 - CZE-DUK 2", "NOVA Jana", "TICHY Radek"]])])!;
    resolveNations(parsed, [{ firstName: "Istvan", lastName: "Peni", nationality: "HUN" }]);
    expect(parsed.mixedTeams!.map((t) => t.nocCode)).toEqual(["HUN", "CZE"]);
  });

  it("gives a pair from two countries both of them", () => {
    const parsed = parseSiusPages([
      teamPage(qualFile, [["FIN-SLO", "MAKELA Veera", "KLEMENCIC Florjan"], ["SLO-RUS", "POTRC Tara", "POTRC Gal"]]),
    ])!;
    // Mäkelä nema pojedinačni red na ovoj listi — država joj se zna iz baze
    parsed.events = bilten([["KLEMENCIC Florjan", "SLO-OLI"], ["POTRC Tara", "SLO-RUS"], ["POTRC Gal", "SLO-RUS"]]).events;
    resolveNations(parsed, [{ firstName: "Veera", lastName: "Makela", nationality: "FIN" }]);
    expect(parsed.mixedTeams!.map((t) => [t.nocCode, !!t.nationAssumed])).toEqual([["FIN/SLO", false], ["SLO", false]]);
  });
});

describe("mešoviti timovi — par bez poznatih država", () => {
  it("flags a two-country label when the shooters are unknown", () => {
    const parsed = parseSiusPages([teamPage("Q200000TA2011261425.1.ARMTJ.0.001.pdf", [
      ["FIN-CZE 2", "SMOLNY Ondrej", "PIETINALHO Helmi"],
      ["CZE-DUK 1", "VERSTEEGH Laura", "TICHY Radek"],
    ])])!;
    resolveNations(parsed, []);
    expect(parsed.mixedTeams!.map((t) => [t.nocCode, !!t.nationAssumed])).toEqual([["FIN/CZE", true], ["CZE", false]]);
  });
});

describe("resolveGuessedNames — obrnuto upisano ime", () => {
  it("restores the order of a shooter known the other way round", () => {
    const parsed = bilten([["MAKSIMILIJAN ŽARIĆ", "SLO"], ["WITTMANN Peter", "APLE"]]);
    resolveGuessedNames(parsed, [{ firstName: "Maksimilijan", lastName: "Žarić" }]);
    expect((parsed.events[0].results as ParsedShooterResult[]).map((r) => [r.lastName, r.firstName]))
      .toEqual([["Žarić", "Maksimilijan"], ["Wittmann", "Peter"]]);
  });
});
