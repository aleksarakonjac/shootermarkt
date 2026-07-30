import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultsHistoryTable, type ResultRowData } from "./ResultsHistoryTable";

const result: ResultRowData = {
  id: 1, competitionId: 1, competitionName: "Kup Srbije", competitionDate: "2026-07-29", competitionDateEnd: null, competitionLocation: null,
  competitionCountry: null, competitionCountryCode2: null, disciplineCode: "ARM", category: "senior",
  qualTotal: "630.0", qualRank: 5, qualInners: null, qualified: true,
  elimTotal: null, elimRank: null, elimRound: null, elimDetail: null,
  finalTotal: "250.1", finalRank: 1, qualDetail: null, finalDetail: null,
};

describe("ResultsHistoryTable", () => {
  it("shows final ranks, with a medal for podium places", () => {
    const { rerender } = render(<ResultsHistoryTable results={[{ ...result, qualInners: 18 }]} />);
    expect(screen.getByLabelText("Mesto 1")).toHaveTextContent("1");
    expect(document.body.textContent).not.toContain("18×");

    rerender(<ResultsHistoryTable results={[{ ...result, finalRank: 4 }]} />);
    expect(screen.getByText("#4")).toBeInTheDocument();
  });

  it("groups disciplines from the same competition under one competition cell", () => {
    render(<ResultsHistoryTable results={[result, { ...result, id: 2, disciplineCode: "APM" }]} />);

    expect(screen.getAllByText("Kup Srbije")).toHaveLength(1);
    const resultsRow = screen.getByText("Kup Srbije").closest("tr")?.nextElementSibling;
    expect(resultsRow?.textContent).toContain("APM");
    expect(resultsRow?.textContent).toContain("ARM");
    expect(screen.getAllByText("ARM")).toHaveLength(2);
    expect(screen.getAllByText("APM")).toHaveLength(2);
  });

  it("shows the full competition date range", () => {
    render(<ResultsHistoryTable results={[{ ...result, competitionDateEnd: "2026-07-31" }]} />);

    expect(screen.getByText("29.-31.07.2026.")).toBeInTheDocument();
  });

  it("does not repeat a location already in the competition name", () => {
    render(<ResultsHistoryTable results={[{ ...result, competitionName: "Kup Srbije — Novi Sad", competitionLocation: "Novi Sad" }]} />);

    expect(screen.getByText("29.07.2026.").textContent).not.toContain(" · Novi Sad");
  });

  it("removes the phase divider for air-rifle details", () => {
    render(<ResultsHistoryTable results={[{ ...result, qualDetail: { series: [105.1, 105.2, 105.3, 105.4, 105.5, 105.6] }, finalDetail: { format: "bulletin", series: [51.2, 102.3] } }]} />);

    fireEvent.click(screen.getByText("ARM"));

    expect(screen.getAllByText("Finale")[1]?.parentElement?.parentElement).not.toHaveClass("border-t");
    expect(screen.getByLabelText("Otvori rezultate kvalifikacija")).toHaveAttribute("href", "/sr/srb/takmicenja/1?result=individual&disc=ARM&category=senior&stage=qual");
    expect(screen.getByLabelText("Otvori rezultate finala")).toHaveAttribute("href", "/sr/srb/takmicenja/1?result=individual&disc=ARM&category=senior&stage=final");
    expect(screen.getAllByLabelText("Mesto 1")).toHaveLength(2);
  });

  it("opens a discipline detail directly below that discipline", () => {
    render(<ResultsHistoryTable results={[
      { ...result, id: 1, disciplineCode: "APM", qualDetail: { series: [95, 96, 97, 98, 99, 100] } },
      { ...result, id: 2, disciplineCode: "ARM" },
    ]} />);

    fireEvent.click(screen.getAllByText("APM")[1]!);

    expect(screen.getByText("Kvalifikacije · #5").closest("tr")?.previousElementSibling?.textContent).toContain("APM");
  });

  it("shows R3P elimination score and series in the expanded row", () => {
    render(<ResultsHistoryTable locale="en" results={[{ ...result, disciplineCode: "R3PM", qualTotal: "590", qualRank: 5, qualDetail: { series: [96, 97, 98, 99, 100, 100] }, elimTotal: 590, elimRank: 4, elimRound: 2, elimDetail: { series: [96, 97, 98, 99, 100, 100] } }]} />);
    fireEvent.click(screen.getByText("R3PM"));

    expect(screen.getByText("Eliminacije · #4")).toBeInTheDocument();
    expect(screen.getByLabelText("Open elimination results")).toHaveAttribute("href", "/sr/srb/takmicenja/1?result=individual&disc=R3PM&category=senior&stage=elim&round=2");
    expect(screen.getAllByText("Kneeling")).toHaveLength(2);
    expect([...document.querySelectorAll("colgroup")].map((group) => group.children.length)).toEqual([6, 6]);
  });
});
