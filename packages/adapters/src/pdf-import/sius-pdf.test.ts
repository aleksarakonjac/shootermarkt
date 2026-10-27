import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ParsedShooterResult } from "@shootermarkt/db/pdf-import-types";
import { parseSiusPdf, parseSiusPages } from "./sius-pdf";

const fixture = readFileSync(new URL("./__fixtures__/sss-kup-10m-nis-2026.pdf", import.meta.url));

describe("parseSiusPdf — I kolo Kupa SSS 10m, Niš 2026", async () => {
  const bilten = (await parseSiusPdf(fixture))!;
  const event = (code: string, category: string, guest = false) =>
    bilten.events.find((e) => e.discipline === code && e.category === category && !!e.guest === guest)!.results as ParsedShooterResult[];

  it("reads every individual list, skips team lists", () => {
    expect(bilten.events.map((e) => `${e.discipline}/${e.category}${e.guest ? "/guest" : ""}:${e.results.length}`)).toEqual([
      "ARM/senior:23", "ARM/junior:18",
      "ARW/senior:51", "ARW/junior:47", "ARW/senior/guest:1",
      "APM/senior:48", "APM/junior:32", "APM/senior/guest:4",
      "APW/senior:37", "APW/junior:28", "APW/senior/guest:3",
    ]);
  });

  it("every series adds up to the total", () => {
    for (const e of bilten.events) for (const r of e.results as ParsedShooterResult[]) {
      if (r.total == null) continue;
      expect(r.series.reduce((a, b) => a + b, 0)).toBeCloseTo(r.total, 1);
    }
  });

  it("parses rifle row with wrapped club name", () => {
    expect(event("ARM", "senior")[13]).toMatchObject({
      rank: 14, bibNumber: 1139, lastName: "Zivkovic", firstName: "Andrija", teamNoc: "SRB", clubName: "SMEDEREVO",
      series: [100.6, 102.4, 100.6, 100.5, 101.1, 102.7], total: 607.9, inners: null, qualified: null, remark: null,
    });
  });

  it("parses pistol total with inner tens and Q", () => {
    expect(event("APM", "senior")[0]).toMatchObject({ rank: 1, lastName: "Gajic", firstName: "Uros", total: 579, inners: 17, qualified: true });
  });

  it("splits guest club and country, keeps Serbian guests SRB", () => {
    const guests = event("APM", "senior", true);
    expect(guests[0]).toMatchObject({ lastName: "Georgiev", teamNoc: "BUL", clubName: "SVETKAVITSA", total: 554, inners: 9 });
    expect(guests[1]).toMatchObject({ lastName: "Milovanovic", teamNoc: "SRB", clubName: "VALJEVO 1880" });
    expect(guests[2]).toMatchObject({ lastName: "Donkov", rank: null, total: null, remark: "DNS" });
  });

  it("derives DNS/DNF the ranking list does not print", () => {
    const arw = event("ARW", "senior");
    expect(arw.find((r) => r.lastName === "Pavlovic" && r.firstName === "Natalija")).toMatchObject({ total: 122.5, remark: "DNF" });
    expect(arw.find((r) => r.lastName === "Belodedic")).toMatchObject({ rank: null, total: null, remark: "DNS" });
  });

  it("returns null for a non-SIUS PDF; finals are skipped and flagged", () => {
    expect(parseSiusPages([[{ x: 0, y: 0, str: "Rezultati kola" }]])).toBeNull();
    expect(parseSiusPages([[{ x: 0, y: 0, str: "F100000IA1710261015.1.ARM.0.001.pdf" }]])).toEqual({ events: [], hasFinals: true });
  });
});

describe("parseSiusPages — two matches in one bulletin", () => {
  // minimalna SIUS strana: naslov, RESULTS, zaglavlje kolona, jedan red, ime fajla u podnožju
  const page = (title: string, file: string, score: string) => [
    { x: 178, y: 811, str: title }, { x: 270, y: 795, str: "RESULTS" },
    { x: 55, y: 684, str: "Rank" }, { x: 100, y: 684, str: "Bib No" }, { x: 133, y: 684, str: "Name" }, { x: 230, y: 684, str: "NOC" },
    { x: 363, y: 676, str: "1" },
    { x: 72, y: 663, str: "1" }, { x: 105, y: 663, str: "1018" }, { x: 132, y: 663, str: "JOVANOVIC Stevan" }, { x: 229, y: 663, str: "CIKA MATA" },
    { x: 349, y: 663, str: score }, { x: 522, y: 663, str: score },
    { x: 52, y: 98, str: file },
  ];

  it("earliest match is the main competition, the next day becomes a named event", () => {
    const bilten = parseSiusPages([
      page("1. KOLO KUPA SSS A 10m NIS 2026", "Q100000IA1710261015.1.ARM.0.001.pdf", "104.3"),
      page("MEMORIJAL ZORAN ZOKI STOJILKOVIC", "Q100000IA1810260900.1.ARM.0.001.pdf", "103.9"),
    ])!;
    expect(bilten.events.map((e) => [e.eventName, e.eventDate, (e.results as ParsedShooterResult[])[0].total])).toEqual([
      [null, null, 104.3],
      ["MEMORIJAL ZORAN ZOKI STOJILKOVIC", "2026-10-18", 103.9],
    ]);
  });
});
