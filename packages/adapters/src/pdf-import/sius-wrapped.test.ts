import { describe, expect, it } from "vitest";
import type { ParsedFinalResult, ParsedShooterResult } from "@shootermarkt/db/pdf-import-types";
import { parseSiusPages } from "./sius-pdf";

// Raspored sa XXII. Hungarian Open (Budimpešta 2026), koordinate iz biltena.
const at = (x: number, y: number, str: string) => ({ x, y, str });

describe("parseSiusPdf — wrapped names", () => {
  const row = (y: number, rank: string, bib: string, name: string, noc: string) => [
    at(72, y, rank), at(105, y, bib), at(132, y, name), at(242, y, noc),
    ...["87", "89", "93", "92", "92", "90"].map((score, i) => at(318 + i * 26, y, score)), at(470, y, "543- 8x"),
  ];
  const bilten = parseSiusPages([[
    at(270, 795, "RESULTS"), at(55, 684, "Rank"), at(100, 684, "Bib No"), at(132, 684, "Name"), at(242, 684, "NOC"), at(321, 676, "1"),
    ...row(415, "16", "560", "ALEKSANDROVA", "BUL"), at(132, 406, "ALEKSANDRA"),
    ...row(390, "17", "6360", "IVANCSÓNÉ Dr. Horváth", "KLK"), at(132, 381, "Zsuzsanna"),
    at(239, 98, "Q000000IA1911261545.1.APW.0.001.pdf"),
  ]])!;
  const rows = bilten.events[0].results as ParsedShooterResult[];

  it("keeps a row whose first name moved to the second line", () => {
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rank: 16, lastName: "Aleksandrova", firstName: "Aleksandra", clubName: "BUL", total: 543, inners: 8 });
  });

  it("keeps the whole name when only the last part wrapped", () => {
    expect(rows[1]).toMatchObject({ rank: 17, lastName: "Ivancsóné", firstName: "Dr. Horváth Zsuzsanna" });
  });
});

describe("parseSiusPdf — final with a wide elimination stage", () => {
  it("reads the first score column when it starts left of its header", () => {
    const bilten = parseSiusPages([[
      at(54, 694, "Rk"), at(97, 694, "Name"), at(200, 698, "NOC"), at(247, 694, "Stage 1"), at(491, 694, "Remarks"),
      at(57, 675, "1"), at(75, 675, "127"), at(97, 675, "STEVANOVIC"), at(201, 675, "SRB"), at(234, 675, "21.3"), at(468, 675, "41.9"), at(97, 665, "Andjelija"),
      at(239, 667, "10.5"), at(265, 667, "10.3"), at(239, 660, "10.8"), at(265, 660, "10.3"),
      at(237, 98, "F000000IA2111261800.1.ARW2.0.001.pdf"),
    ]])!;
    expect(bilten.hasFinals).toBe(false);
    expect((bilten.events[0].results as ParsedFinalResult[])[0]).toMatchObject({
      rank: 1, lastName: "Stevanovic", firstName: "Andjelija", teamNoc: "SRB", total: 41.9, cumulative: [21.3, 41.9],
    });
  });
});

describe("parseSiusPdf — mixed team list", () => {
  it("does not warn about a last page that carries only the footer", () => {
    const bilten = parseSiusPages([[
      at(57, 700, "Rank"), at(85, 700, "Bib No Name"), at(273, 690, "1"), at(52, 170, "Summary"),
      at(234, 98, "Q200000TA2011260920.1.APMTJ.0.001.pdf"),
    ]])!;
    expect(bilten.warnings).toBeUndefined();
  });
});
