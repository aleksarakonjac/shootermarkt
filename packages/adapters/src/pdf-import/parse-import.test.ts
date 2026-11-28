import { describe, expect, it, vi } from "vitest";
import { shooters } from "@shootermarkt/db/schema";
import { parsePdfImport } from "./parse-import";

const mock = vi.hoisted(() => ({ shooters: [] as Record<string, unknown>[], pages: [] as { x: number; y: number; str: string }[][] }));

// bez baze: select vraća samo tražene kolone, kao pravi upit
vi.mock("@shootermarkt/db", () => ({
  db: {
    select: (columns?: Record<string, unknown>) => ({
      from: async (table: unknown) => table === shooters
        ? mock.shooters.map((row) => Object.fromEntries(Object.keys(columns!).map((key) => [key, row[key]])))
        : [],
    }),
  },
}));
vi.mock("./sius-pdf", async (importOriginal) => {
  const real = await importOriginal<typeof import("./sius-pdf")>();
  return { ...real, parseSiusPdf: async () => real.parseSiusPages(mock.pages) };
});

// minimalna SIUS strana juniorske liste (tip liste 20) sa jednim redom
const juniorPage = (title: string, file: string) => [
  { x: 178, y: 811, str: title }, { x: 270, y: 795, str: "RESULTS" },
  { x: 55, y: 684, str: "Rank" }, { x: 100, y: 684, str: "Bib No" }, { x: 133, y: 684, str: "Name" }, { x: 230, y: 684, str: "NOC" },
  { x: 363, y: 676, str: "1" },
  { x: 72, y: 663, str: "1" }, { x: 105, y: 663, str: "1018" }, { x: 132, y: 663, str: "JOVANOVIC Stevan" }, { x: 229, y: 663, str: "CIKA MATA" },
  { x: 349, y: 663, str: "104.3" }, { x: 522, y: 663, str: "104.3" },
  { x: 52, y: 98, str: file },
];

describe("parsePdfImport — namesake age limit", () => {
  // dva meča preko Nove godine: glavni (bez eventDate) 30.12.2026, drugi 02.01.2027
  mock.pages = [
    juniorPage("KUP", "Q100000IA3012261015.20.ARM.0.001.pdf"),
    juniorPage("MEMORIJAL", "Q100000IA0201270900.20.ARM.0.001.pdf"),
  ];
  const links = async (birthYear: number) => {
    mock.shooters = [{ id: 1, firstName: "Stevan", lastName: "Jovanovic", nationality: "SRB", birthYear }];
    return (await parsePdfImport(Buffer.from(""))).rows.map((r) => [r.eventDate, r.shooterId]);
  };

  it("does not link a junior result to a namesake too old for the category", async () => {
    expect(await links(1981)).toEqual([[null, undefined], ["2027-01-02", undefined]]);
  });

  it("measures age on the match day, the main match on the bulletin's earliest date", async () => {
    // 21 godina 2026. (junior), 22 godine 2027.
    expect(await links(2005)).toEqual([[null, 1], ["2027-01-02", undefined]]);
  });
});
