import { describe, expect, it } from "vitest";
import { EXCEL_RESULT_HEADERS, EXCEL_TEMPLATE_EXAMPLE_FIRST_NAME } from "./template";
import { parseExcelResultRows } from "./parse";

const completeRow = {
  competition_id: "",
  competition_name: "Kup Srbije",
  competition_date: "2026-07-10",
  competition_date_end: "",
  competition_location: "Novi Sad",
  competition_level: "national",
  competition_event_type: "cup",
  competition_organizer: "SSS",
  first_name: "Milan",
  last_name: "Petrović",
  team_noc: "SRB",
  birth_year: "2001",
  gender: "M",
  apparatus: "air_rifle",
  club_name: "SK Novi Sad",
  discipline_code: "ARM",
  result_category: "senior",
  qualification_total: "628.4",
  qualification_inners: "52",
  qualification_rank: "1",
  series_1: "104.5",
  series_2: "104.8",
  series_3: "104.7",
  series_4: "104.6",
  series_5: "104.9",
  series_6: "104.9",
  qualified: "DA",
  final_total: "251.2",
  final_rank: "1",
};

describe("parseExcelResultRows", () => {
  it("parses a valid results row and competition metadata", () => {
    const parsed = parseExcelResultRows([completeRow], [...EXCEL_RESULT_HEADERS]);

    expect(parsed.errors).toEqual([]);
    expect(parsed.competition).toMatchObject({ name: "Kup Srbije", level: "national", eventType: "cup" });
    expect(parsed.rows[0]).toMatchObject({
      firstName: "Milan",
      lastName: "Petrović",
      disciplineCode: "ARM",
      qualTotal: 628.4,
      qualified: true,
      finalRank: 1,
    });
    expect(parsed.rows[0].qualSeries).toEqual([104.5, 104.8, 104.7, 104.6, 104.9, 104.9]);
  });

  it("reports required and invalid values without returning the row", () => {
    const parsed = parseExcelResultRows([
      { ...completeRow, first_name: "", discipline_code: "BAD", qualification_total: "nije broj" },
    ], [...EXCEL_RESULT_HEADERS]);

    expect(parsed.rows).toEqual([]);
    expect(parsed.errors.join(" ")).toContain("first_name je obavezan");
    expect(parsed.errors.join(" ")).toContain("discipline_code mora biti");
    expect(parsed.errors.join(" ")).toContain("qualification_total mora biti broj");
  });

  it("skips the example row bundled with the template", () => {
    const parsed = parseExcelResultRows([
      { ...completeRow, first_name: EXCEL_TEMPLATE_EXAMPLE_FIRST_NAME },
    ], [...EXCEL_RESULT_HEADERS]);

    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toEqual([]);
  });
});
