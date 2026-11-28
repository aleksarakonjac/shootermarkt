import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseClubTeams, type ClubTeamPage } from "./sius-club-teams";
import { extractSiusPages, parseSiusPages, parseSiusPdf } from "./sius-pdf";
import type { Item } from "./sius-layout";

const fixture = readFileSync(new URL("./__fixtures__/sss-kup-10m-nis-2026.pdf", import.meta.url));

describe("parseSiusPdf — club teams of the Niš cup", async () => {
  const bilten = (await parseSiusPdf(fixture))!;
  const teams = (code: string) => (bilten.teamResults ?? []).filter((t) => t.disciplineCode === code && !t.eventName);

  it("reads club teams with counted members only", () => {
    expect(teams("ARM").map((t) => [t.rank, t.teamName, t.total])).toEqual([
      [1, "Cika Mata", 1865.2], [2, "Novi Sad 1790", 1815.8], [3, "Jasenica", 1755.6]]);
    expect(teams("ARM")[0].members.map((m) => [m.lastName, m.firstName, m.total])).toEqual([
      ["Jovanovic", "Stevan", 625.3], ["Jovanovic", "Bogdan", 621.1], ["Stankovic", "Jovan", 618.8]]);
    expect(teams("ARM")[0].members[0].series).toEqual([104.3, 104.0, 103.9, 104.9, 105.0, 103.2]);
  });

  it("reads pistol inners, a wrapped total and skips DNS and parenthesized shooters", () => {
    expect(teams("APM")[0]).toMatchObject({ teamName: "Pancevo 1813", total: 1691, inners: 32 });
    expect(teams("APM")[2]).toMatchObject({ teamName: "Policajac", total: 1636, inners: 25 });
    expect(teams("APM").every((t) => t.members.length === 3)).toBe(true);
  });

  it("keeps a printed rank of a DNF team and counts the partial score the bulletin counted", () => {
    const jagodina = teams("ARW").find((t) => t.teamName === "Jagodina 92")!;
    expect(jagodina).toMatchObject({ rank: 10, total: 1300.6, remark: "DNF" });
    expect(jagodina.members.map((m) => m.total)).toEqual([591.6, 586.5, 122.5]);
    expect(teams("ARW")).toHaveLength(11);
  });

  it("tells the day of the main match, for naming a later match", () => expect(bilten.mainDate).toBe("2026-10-17"));

  it("keeps a team list printed a day later in the match of its only individual list", async () => {
    const pages = await extractSiusPages(fixture);
    const late = pages.map((items) => items.map((it) => ({ ...it, str: it.str.replace(/^(Q\d+TA)171026(\d{4}\.\d+\.ARM\.)/, "$1181026$2") })));
    const arm = parseSiusPages(late)!.teamResults!.filter((t) => t.disciplineCode === "ARM" && t.category === "senior");
    expect(arm.map((t) => [t.teamName, t.eventName])).toEqual([["Cika Mata", null], ["Novi Sad 1790", null], ["Jasenica", null]]);
  });

  it("puts every team in the same match and category as its shooters", () => {
    expect(bilten.teamResults!.length).toBeGreaterThan(0);
    for (const t of bilten.teamResults!) {
      const own = bilten.events.find((e) => e.stage === "qualification" && !e.guest && e.discipline === t.disciplineCode
        && e.category === t.category && (e.eventName ?? null) === (t.eventName ?? null));
      const names = new Set((own?.results ?? []).map((r) => `${r.lastName} ${r.firstName}`));
      expect(t.members.filter((m) => !names.has(`${m.lastName} ${m.firstName}`)), `${t.disciplineCode} ${t.teamName}`).toEqual([]);
    }
    expect(bilten.warnings ?? []).toEqual([]);
  });
});

describe("parseSiusPdf — international team standings (Salona)", async () => {
  const salona = (await parseSiusPdf(readFileSync(new URL("./__fixtures__/sius-salona-dc-open-2026.pdf", import.meta.url))))!;

  it("reads teams whose totals carry a junior mark and whose rows wrap", () => {
    const first = salona.teamResults!.filter((t) => t.disciplineCode === "ARM" && t.rank === 1)[0];
    expect(first).toMatchObject({ teamName: "CRO-DALMACIJACEMENT", total: 1890.5 });
    expect(first.members.map((m) => [m.lastName, m.total, m.teamNoc])).toEqual([["Gorša", 631.7, "CRO"], ["Tadić", 630.2, "CRO"], ["Sikavica", 628.6, "CRO"]]);
    expect(salona.warnings ?? []).toEqual([]);
  });
});

/** Minimalna ekipna strana: dve ekipe po jedan strelac, kolone kao u SIUS biltenu. */
function page(teams: { name: string; total: string; member: string }[]): ClubTeamPage {
  const items: Item[] = [
    { x: 55, y: 684, str: "Rank" }, { x: 81, y: 684, str: "Bib No" }, { x: 113, y: 684, str: "Name" }, { x: 431, y: 684, str: "Total" },
    { x: 275, y: 676, str: "1" },
  ];
  teams.forEach((t, i) => {
    const y = 656 - i * 40;
    items.push({ x: 72, y, str: String(i + 1) }, { x: 112, y, str: t.name }, { x: 436, y, str: t.total });
    items.push({ x: 85, y: y - 17, str: `100${i}` }, { x: 112, y: y - 17, str: "TEST Strelac" }, { x: 261, y: y - 17, str: t.member }, { x: 441, y: y - 17, str: t.member });
  });
  return { discipline: "ARM", category: "senior", eventName: null, eventDate: "2026-10-17", items };
}

describe("parseClubTeams", () => {
  it("suffixes a repeated team name", () => {
    const { entries } = parseClubTeams([page([{ name: "Klub", total: "600.0", member: "600.0" }, { name: "Klub", total: "590.0", member: "590.0" }])]);
    expect(entries.map((t) => t.teamName)).toEqual(["Klub", "Klub (2)"]);
  });

  it("reports a page whose sum is wrong and keeps the others", () => {
    const good = page([{ name: "Dobar", total: "600.0", member: "600.0" }]);
    const bad = { ...page([{ name: "Loš", total: "601.0", member: "600.0" }]), discipline: "ARW" as const };
    const { entries, warnings } = parseClubTeams([good, bad]);
    expect(entries.map((t) => t.teamName)).toEqual(["Dobar"]);
    expect(warnings).toEqual(["Ekipe ARW: strana nije pročitana (2026-10-17)"]);
  });
});
