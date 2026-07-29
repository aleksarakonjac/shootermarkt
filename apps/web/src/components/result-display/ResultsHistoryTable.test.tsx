import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultsHistoryTable, type ResultRowData } from "./ResultsHistoryTable";

const result: ResultRowData = {
  id: 1, competitionName: "Kup Srbije", competitionDate: "2026-07-29", competitionLocation: null,
  competitionCountry: null, competitionCountryCode2: null, disciplineCode: "ARM", category: "senior",
  qualTotal: "630.0", qualRank: 5, qualInners: null, qualified: true,
  finalTotal: "250.1", finalRank: 1, qualDetail: null, finalDetail: null,
};

describe("ResultsHistoryTable", () => {
  it("shows final ranks, with a medal for podium places", () => {
    const { rerender } = render(<ResultsHistoryTable results={[result]} />);
    expect(screen.getByLabelText("Mesto 1")).toHaveTextContent("1");

    rerender(<ResultsHistoryTable results={[{ ...result, finalRank: 4 }]} />);
    expect(screen.getByText("#4")).toBeInTheDocument();
  });
});
