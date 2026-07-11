import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { createResultsTemplate, EXCEL_RESULT_HEADERS, EXCEL_TEMPLATE_EXAMPLE_FIRST_NAME } from "./template";

describe("createResultsTemplate", () => {
  it("creates a workbook with results columns and instructions", () => {
    const workbook = XLSX.read(createResultsTemplate(), { type: "buffer" });
    const resultsSheet = workbook.Sheets.Rezultati;

    expect(workbook.SheetNames).toEqual(["Rezultati", "Uputstvo"]);
    const rows = XLSX.utils.sheet_to_json<string[]>(resultsSheet, { header: 1 });
    expect(rows[0]).toEqual(EXCEL_RESULT_HEADERS);
    expect(rows[1][8]).toBe(EXCEL_TEMPLATE_EXAMPLE_FIRST_NAME);
  });
});
