import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { foldName } from "@shootermarkt/db/name-match";
import { mergeFinalsIntoRows, type ParsedFinalResult, type ParsedShooterResult, type ReviewRow } from "@shootermarkt/db/pdf-import-types";
import { parseSiusPdf, parseSiusPages } from "./sius-pdf";

const fixture = readFileSync(new URL("./__fixtures__/sss-memorial-10m-nis-2026.pdf", import.meta.url));

describe("parseSiusPdf — 10m finala, II Memorijal Zoran Zoki Stojiljković, Niš 2026", async () => {
  const bilten = (await parseSiusPdf(fixture))!;
  const final = (code: string) => bilten.events.find((e) => e.stage === "final" && e.discipline === code)!.results as ParsedFinalResult[];

  it("reads all four finals, so nothing is left for Gemini", () => {
    expect(bilten.hasFinals).toBe(false);
    expect(["ARM", "ARW", "APM", "APW"].map((code) => final(code).map((r) => r.rank))).toEqual(Array(4).fill([1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it("keeps the running total after every series, with its column names", () => {
    expect(final("ARM")[0]).toMatchObject({
      lastName: "Savic", firstName: "David", teamNoc: "SRB", total: 247,
      cumulative: [51.1, 103, 124, 144.5, 164.9, 185.6, 206.2, 226.8, 247],
      seriesLabels: ["S1", "S2", "11–12", "13–14", "15–16", "17–18", "19–20", "21–22", "23–24"],
    });
    expect(final("APW")[7]).toMatchObject({ lastName: "Mikulovic", total: 98.7, cumulative: [42.1, 80.6, 98.7] });
  });

  it("reads DNS, shoot-off and a guest's country", () => {
    expect(final("ARM")[7]).toMatchObject({ lastName: "Ivanovic", firstName: "Marko", total: null, remark: "DNS" });
    expect(final("ARW")[2]).toMatchObject({ lastName: "Ponjavic", total: 230.2, remark: "SO" });
    expect(final("ARW")[4]).toMatchObject({ lastName: "Boyanova", teamNoc: "BUL" });
  });

  it("every finalist matches a qualification row", () => {
    const rows = bilten.events.filter((e) => e.stage === "qualification").flatMap((e) => (e.results as ParsedShooterResult[]).map((r): ReviewRow => ({
      firstName: r.firstName, lastName: r.lastName, teamNoc: r.teamNoc, disciplineCode: e.discipline, category: e.category,
      eventName: e.eventName, eventDate: e.eventDate, qualTotal: r.total,
    })));
    const merged = mergeFinalsIntoRows(rows, bilten.events, foldName);
    expect(merged).toMatchObject({ matchedFinals: 32, unmatchedFinals: 0 });
    expect(merged.rows.find((r) => r.lastName === "Ivanovic" && r.finalRank === 8)).toMatchObject({ finalTotal: null, finalRemark: "DNS" });
    expect(merged.rows.find((r) => r.lastName === "Ponjavic")).toMatchObject({ finalRank: 3, finalShootOff: true, finalRemark: null });
  });

  it("leaves a final it cannot verify to the fallback", () => {
    const broken = parseSiusPages([[
      { x: 54, y: 694, str: "Rk" }, { x: 97, y: 694, str: "Name" }, { x: 200, y: 698, str: "NOC" }, { x: 235, y: 694, str: "Stage 1" }, { x: 491, y: 694, str: "Remarks" },
      { x: 57, y: 675, str: "1" }, { x: 97, y: 675, str: "SAVIC" }, { x: 234, y: 675, str: "51.1" }, { x: 97, y: 665, str: "David" }, { x: 239, y: 667, str: "10.8" },
      { x: 240, y: 98, str: "F100000IA1810261500.1.ARM.0.001.pdf" },
    ]]);
    expect(broken).toEqual({ events: [], hasFinals: true });
  });
});
