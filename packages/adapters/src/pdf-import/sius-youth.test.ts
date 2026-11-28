/** Raspored SIUS biltena omladinskog kupa: NOC/Code i Team kolone, grupe U16–U21 i godišta uz zbir. */
import { describe, expect, it } from "vitest";
import type { ParsedShooterResult } from "@shootermarkt/db/pdf-import-types";
import { parseSiusPages } from "./sius-pdf";
import type { Item } from "./sius-layout";

/** "x:tekst" stavke jednog reda strane. */
const row = (y: number, ...cells: string[]): Item[] => cells.map((cell) => ({ x: Number(cell.slice(0, cell.indexOf(":"))), y, str: cell.slice(cell.indexOf(":") + 1) }));
const head = (title: string, sub: string, file: string): Item[] => [
  ...row(811, "178:Youth Cup 2026"), ...row(795, "270:RESULTS"), ...row(780, "236:10m AIR PISTOL MEN"), ...row(765, `287:${sub}`), ...row(98, `228:${file}`),
];
const series = (y: number, from: number, values: number[]) => values.map((v, i) => ({ x: from + i * 26, y, str: String(v) }));

describe("youth individual list", () => {
  const page = [
    ...head("APM", "U16", "Q100000IA2711261315.400000.APM.0.001.pdf"),
    ...row(689, "215:NOC"), ...row(684, "55:Rank", "81:Bib No", "113:Name", "243:Team", "476:Total", "510:Rem"), ...row(679, "215:Code"), ...series(676, 327, [1, 2, 3, 4, 5, 6]),
    ...row(663, "72:1", "85:1083", "112:STRANAC Petar", "243:Bulgaria", "477:566-16x 20"), ...series(663, 325, [92, 98, 91, 95, 97, 93]), ...row(662, "214:BUL"), ...row(654, "511:11"),
    ...row(638, "72:2", "85:1204", "112:DOMACI Marko"), ...row(637, "214:SRB", "243:Milorad Mancic -", "477:513- 5x 20"), ...series(637, 325, [86, 92, 87, 85, 79, 84]), ...row(629, "243:Lukanjac", "511:12"),
  ];
  const results = () => parseSiusPages([page])!.events[0].results as ParsedShooterResult[];

  it("reads totals, inners and birth year printed beside the total", () => {
    expect(results().map((r) => [r.total, r.inners, r.birthYear, r.series.length])).toEqual([[566, 16, 2011, 6], [513, 5, 2012, 6]]);
  });

  it("takes the nation from the code column and keeps a club only for domestic shooters", () => {
    expect(results().map((r) => [r.teamNoc, r.clubName, !!r.nationUnstated])).toEqual([
      ["BUL", undefined, false], ["SRB", "Milorad Mancic - Lukanjac", false]]);
    expect(parseSiusPages([page])!.events[0].category).toBe("kadet");
  });
});

describe("remarks column", () => {
  const list = (items: Item[]) => parseSiusPages([[
    ...head("APM", "U16", "Q100000IA2711261315.400000.APM.0.001.pdf"),
    ...row(689, "215:NOC"), ...row(684, "55:Rank", "81:Bib No", "113:Name", "243:Team", "476:Total", "510:Rem"), ...row(679, "215:Code"), ...series(676, 327, [1, 2, 3, 4, 5, 6]),
    ...items,
  ]])!.events[0].results as ParsedShooterResult[];
  const shooter = (y: number, rank: number, total?: string) => [
    ...row(y, `72:${rank}`, `85:${1000 + rank}`, "112:STRELAC Test", "214:SRB", "243:Klub", ...(total ? [`477:${total}`] : [])),
    ...(total ? series(y, 325, [85, 83, 86, 88, 79, 64]) : []),
  ];
  const stack = (y: number, ...letters: string[]) => letters.flatMap((str, i) => row(y - i * 9.4, `511:${str}`));

  it("reads a status stacked letter by letter, with the birth year under it", () => {
    const [dnf, dns] = list([
      ...shooter(655, 1, "485- 6x D"), ...stack(645.6, "N", "F", "20", "11"),
      ...shooter(601, 2), ...stack(601, "D", "N", "S", "20", "10"),
    ]);
    expect(dnf).toMatchObject({ total: 485, inners: 6, remark: "DNF", birthYear: 2011 });
    expect(dns).toMatchObject({ total: null, remark: "DNS", birthYear: 2010 });
  });

  it("splits Q, status, record and shoot-off printed beside the total; birth year is never a remark", () => {
    const rows = list([
      ...shooter(655, 1, "485- 6x Q QNR 2011"),
      ...shooter(630, 2, "485- 6x Q SO 2010"),
      ...shooter(605, 3, "485- 6x DSQ 2009"),
      ...shooter(580, 4, "485- 6x RPO 2008"),
      ...shooter(555, 5, "485- 6x +10.4 2008"),
      ...shooter(530, 6, "485- 6x 2008"),
    ]);
    expect(rows.map((r) => [r.total, r.remark, r.qualified, r.extras ?? null, r.birthYear])).toEqual([
      [485, null, true, { record: "QNR" }, 2011],
      [485, null, true, { shootOff: "SO" }, 2010],
      [485, "DSQ", null, null, 2009],
      [485, "RPO", null, null, 2008],
      [485, null, null, { shootOff: "+10.4" }, 2008],
      [485, null, null, null, 2008],
    ]);
  });
});

describe("youth team list", () => {
  const member = (y: number, bib: string, name: string, group: string, scores: number[], total: string) =>
    [...row(y, `85:${bib}`, `112:${name}`, `256:${group}`, `466:${total}`), ...series(y, 315, scores)];
  const page = (items: Item[]) => [
    ...head("APM", "TEAM", "Q100000TA2711261315.1.APM.0.001.pdf"),
    ...row(689, "256:Shooter"), ...row(684, "55:Rank", "81:Bib No", "113:Name", "466:Total", "500:Remarks"), ...row(679, "256:Group"), ...series(676, 317, [1, 2, 3, 4, 5, 6]),
    ...items,
  ];
  const first = page([
    ...row(656, "72:1", "112:Klub Mladih", "462:1652-28x"), ...series(656, 310, [277, 275, 278, 271, 278, 273]),
    ...member(639, "1238", "PRVI Mateja", "U16", [92, 95, 95, 92, 92, 92], "558- 6x 2012"),
    ...member(622, "1240", "DRUGI Lazar", "U18", [92, 91, 91, 88, 93, 90], "545-11x 2008"),
    ...member(605, "1242", "TRECI Toni", "U16", [93, 89, 92, 91, 93, 91], "549-11x 2011"),
    ...member(588, "1243", "VISAK Ana", "U16", [93, 89, 92, 91, 93, 91], "(549-11x) 2011"),
  ]);
  const second = page([
    ...row(656, "72:2", "112:Drugi Klub", "462:1559-3x"), ...series(656, 310, [259, 260, 260, 260, 260, 260]),
    ...member(639, "1300", "CETVRTI Pera", "U21", [90, 90, 90, 90, 90, 90], "540- 1x 2006"),
    ...member(622, "1301", "PETI Mika", "U16", [85, 85, 85, 85, 85, 84], "509- 1x 2011"),
    ...member(605, "1302", "SESTI Zika", "U16", [85, 85, 85, 85, 85, 85], "510- 1x 2011"),
  ]);
  const parsed = () => parseSiusPages([first, second])!;

  it("reads members without the group column or birth year in their name and score", () => {
    expect(parsed().warnings ?? []).toEqual([]);
    expect(parsed().teamResults![0].members.map((m) => [m.lastName, m.firstName, m.total])).toEqual([["Prvi", "Mateja", 558], ["Drugi", "Lazar", 545], ["Treci", "Toni", 549]]);
  });

  it("takes a result in parentheses when the team row adds up only with it", () => {
    // ekipa je tri najbolja od navedenih: ulazi četvrti (u zagradi), a ne drugi
    const items = page([
      ...row(656, "72:1", "112:Klub", "462:1675-6x"), ...series(656, 310, [279, 279, 279, 279, 279, 280]),
      ...member(639, "1", "PRVI Ana", "U16", [93, 93, 93, 93, 93, 94], "559- 2x 2012"),
      ...member(622, "2", "SLAB Iva", "U16", [90, 90, 90, 90, 90, 90], "540- 1x 2011"),
      ...member(605, "3", "TRECI Mia", "U16", [93, 93, 93, 93, 93, 91], "556- 2x 2010"),
      ...member(588, "4", "CETVRTI Lea", "U16", [93, 93, 93, 93, 93, 95], "(560- 2x) 2011"),
    ]);
    const parsedTeam = parseSiusPages([items])!;
    expect(parsedTeam.warnings ?? []).toEqual([]);
    expect(parsedTeam.teamResults![0].members.map((m) => m.lastName)).toEqual(["Prvi", "Treci", "Cetvrti"]);
  });

  it("does not search for a line-up in an implausibly long block", () => {
    // više od 10 navedenih uz jednu ekipu znači pogrešno pročitanu stranu; broj kombinacija bi rastao bez granice
    const extra = Array.from({ length: 8 }, (_, i) => member(554 - i * 12, `${10 + i}`, `VISAK${i} Ana`, "U16", [80, 80, 80, 80, 80, 80], "(480- 1x) 2011"));
    const items = page([
      ...row(656, "72:1", "112:Klub", "462:1675-6x"), ...series(656, 310, [279, 279, 279, 279, 279, 280]),
      ...member(639, "1", "PRVI Ana", "U16", [93, 93, 93, 93, 93, 94], "559- 2x 2012"),
      ...member(622, "2", "SLAB Iva", "U16", [90, 90, 90, 90, 90, 90], "540- 1x 2011"),
      ...member(605, "3", "TRECI Mia", "U16", [93, 93, 93, 93, 93, 91], "556- 2x 2010"),
      ...member(588, "4", "CETVRTI Lea", "U16", [93, 93, 93, 93, 93, 95], "(560- 2x) 2011"),
      ...extra.flat(),
    ]);
    expect(parseSiusPages([items])!.warnings).toEqual(["Ekipe APM: strana nije pročitana (2026-11-27)"]);
  });

  it("files the whole list under the oldest age group listed on it", () => {
    expect(parsed().teamResults!.map((t) => [t.teamName, t.category])).toEqual([["Klub Mladih", "junior"], ["Drugi Klub", "junior"]]);
  });
});

describe("youth mixed teams", () => {
  const mixedHead = (sub: string, file: string): Item[] => [...row(795, "270:RESULTS"), ...row(765, `262:${sub}`), ...row(98, `236:${file}`)];
  const athlete = (y: number, bib: string, name: string, scores: number[], total: string) =>
    [...row(y, `85:${bib}`, `112:${name}`, `359:${total}`), ...series(y, 261, scores)];
  const team = (y: number, rank: number, label: string, total: string, a: [string, string], b: [string, string], year: number) => [
    ...row(y, `72:${rank}`, `112:${label}`, `359:${total}`, "384:Q"),
    ...athlete(y - 17, a[0], a[1], [100.0, 100.0, 100.0], `300.0 ${year}`), ...athlete(y - 34, b[0], b[1], [101.0, 101.0, 101.0], `303.0 ${year}`),
  ];
  const qual = (year: number) => [
    ...mixedHead("Qualification", "Q200000TA2711260900.1.ARMT.0.001.pdf"),
    ...row(684, "55:Rank", "81:Bib No", "113:Name", "349:Total", "382:Remarks"), ...series(676, 275, [1, 2, 3]),
    ...team(656, 1, "Bulgaria 2", "603.0", ["1094", "PRVA Denica"], ["1096", "DRUGI Dimitar"], year),
    ...team(600, 2, "Gatos", "603.0", ["1125", "TRECA Ana"], ["1126", "CETVRTI Marko"], year),
  ];
  const final = [
    ...mixedHead("FINAL", "F200000TA2711261300.1.ARMT.0.001.pdf"),
    ...row(689, "56:Rk", "75:Bib No Name", "254:Stage 1", "452:Total Remarks"),
    ...row(665, "63:1", "104:Gatos - Gatos", "259:101.0", "452:101.0"),
    ...athlete(647, "1125", "TRECA A.", [], "50.0").map((it) => ({ ...it, x: it.x === 85 ? 84 : it.x === 359 ? 452 : it.x })),
    ...athlete(629, "1126", "CETVRTI Marko", [], "51.0").map((it) => ({ ...it, x: it.x === 85 ? 84 : it.x === 359 ? 452 : it.x })),
  ];

  it("reads a list with birth years as junior, together with its final", () => {
    const parsed = parseSiusPages([qual(2009), final])!;
    expect(parsed.warnings ?? []).toEqual([]);
    expect(parsed.mixedTeams!.map((t) => [t.category, t.qualTotal, t.mTotal, t.finalRank])).toEqual([["junior", 603, 300, null], ["junior", 603, 300, 1]]);
  });

  it("stays senior when somebody is older than junior age", () => {
    expect(parseSiusPages([qual(1990)])!.mixedTeams![0].category).toBe("senior");
  });

  it("reads a team named after a country as that nation, and asks about the rest", () => {
    expect(parseSiusPages([qual(2009)])!.mixedTeams!.map((t) => [t.nocCode, t.clubName, !!t.nationAssumed])).toEqual([
      ["BUL", undefined, false], ["SRB", "Gatos", true]]);
  });
});
