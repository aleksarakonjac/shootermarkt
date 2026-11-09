import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultsHistoryTable, sortHistoryRows, type ResultRowData } from "./ResultsHistoryTable";

const result: ResultRowData = {
  id: 1, rowKey: "r:1", kind: "individual", competitionId: 1, competitionName: "Kup Srbije", competitionDate: "2026-07-29", competitionDateEnd: null, competitionLocation: null,
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
    render(<ResultsHistoryTable results={[result, { ...result, id: 2, rowKey: "r:2", disciplineCode: "APM" }]} />);

    expect(screen.getAllByText("Kup Srbije")).toHaveLength(1);
    expect(screen.getAllByText("10m vazdušna puška")).toHaveLength(2);
    expect(screen.getAllByText("10m vazdušni pištolj")).toHaveLength(2);
    expect(screen.queryByText("ARM")).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByText("10m vazdušna puška"));

    expect(screen.getAllByText("Finale")[1]?.parentElement?.parentElement).not.toHaveClass("border-t");
    expect(screen.getByLabelText("Otvori rezultate kvalifikacija")).toHaveAttribute("href", "/sr/srb/takmicenja/1?result=individual&disc=ARM&category=senior&stage=qual");
    expect(screen.getByLabelText("Otvori rezultate finala")).toHaveAttribute("href", "/sr/srb/takmicenja/1?result=individual&disc=ARM&category=senior&stage=final");
    expect(screen.getAllByLabelText("Mesto 1")).toHaveLength(2);
  });

  it("opens a discipline detail directly below that discipline", () => {
    render(<ResultsHistoryTable results={[
      { ...result, id: 1, disciplineCode: "APM", qualDetail: { series: [95, 96, 97, 98, 99, 100] } },
      { ...result, id: 2, rowKey: "r:2", disciplineCode: "ARM" },
    ]} />);

    fireEvent.click(screen.getAllByText("10m vazdušni pištolj")[1]!);

    expect(screen.getByText("Kvalifikacije · #5").closest("tr")?.previousElementSibling?.textContent).toContain("10m vazdušni pištolj");
  });

  it("shows R3P elimination score and series in the expanded row", () => {
    render(<ResultsHistoryTable locale="en" results={[{ ...result, disciplineCode: "R3PM", qualTotal: "590", qualRank: 5, qualDetail: { series: [96, 97, 98, 99, 100, 100] }, elimTotal: 590, elimRank: 4, elimRound: 2, elimDetail: { series: [96, 97, 98, 99, 100, 100] } }]} />);
    fireEvent.click(screen.getByText("50m Rifle 3x20"));

    expect(screen.getByText("Eliminations · #4")).toBeInTheDocument();
    expect(screen.getByLabelText("Open elimination results")).toHaveAttribute("href", "/sr/srb/takmicenja/1?result=individual&disc=R3PM&category=senior&stage=elim&round=2");
    expect(screen.getAllByText("Kneeling")).toHaveLength(2);
    expect([...document.querySelectorAll("colgroup")].map((group) => group.children.length)).toEqual([6, 6]);
  });

  const MIXED: ResultRowData = { ...result, id: 9, rowKey: "m:9", kind: "mixed", disciplineCode: "ARMT", partnerName: "Ž. Petrović", qualTotal: "629.1", qualRank: 6, finalTotal: null, finalRank: null, mixedDetail: { own: { series: [105.1], total: 315.2 }, partner: { series: [104.9], total: 313.9 } } };
  const SOLO: ResultRowData = {
    ...result, id: 3, rowKey: "r:3", kind: "esc", disciplineCode: "SOLOARM", qualTotal: "52", qualRank: 1, finalTotal: "10", finalRank: 2,
    qualDetail: { format: "esc_solo", part1: { series: [9, 9, 8], total: 26, rank: 4, remark: "Q" }, part2: { series: [9, 8, 9, 7, 9, 10], total: 52, rank: 1, remark: "QG" } },
    finalDetail: { format: "bulletin", scoring: "hit_count", series: [2, 2, 2, 2, 2], opponentTotal: 12, opponentName: "LINDGREN Victor" },
  };
  const SOLO_OUT: ResultRowData = { ...SOLO, id: 4, rowKey: "r:4", qualTotal: "27", qualRank: 18, finalTotal: null, finalRank: null, finalDetail: null, qualDetail: { format: "esc_solo", part1: { series: [9, 9, 9], total: 27, rank: 18, remark: null } } };

  it("orders individual, mixed, then ESC rows inside a competition", () => {
    expect(sortHistoryRows([SOLO, MIXED, result]).map((r) => r.kind)).toEqual(["individual", "mixed", "esc"]);
  });

  it("renders full discipline names, partner and Solo match", () => {
    render(<ResultsHistoryTable results={[result, MIXED, SOLO]} locale="sr" />);
    expect(screen.getAllByText("10m vazdušna puška").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10m vazdušna puška miks").length).toBeGreaterThan(0);
    expect(screen.getByText("sa Ž. Petrović")).toBeInTheDocument();
    expect(screen.getAllByText("10m vazdušna puška ESC Solo").length).toBeGreaterThan(0);
    expect(screen.getByText(/meč 10 : 12/)).toBeInTheDocument();
    expect(screen.queryByText("ARM")).not.toBeInTheDocument();
  });

  it("shows placement for a Solo shooter out after qualification 1", () => {
    render(<ResultsHistoryTable results={[SOLO_OUT]} locale="sr" />);
    expect(screen.getByText(/27 hitova/)).toBeInTheDocument();
    expect(screen.getByText(/18\. mesto/)).toBeInTheDocument();
  });

  it("shows the Solo qualification mark and a shoot-off on the match", () => {
    const tied: ResultRowData = { ...SOLO, finalTotal: "12", finalRank: 2, finalDetail: { ...SOLO.finalDetail!, opponentTotal: 12 } as ResultRowData["finalDetail"], remarkDetails: { final: { shootOff: "SO" } } };
    render(<ResultsHistoryTable results={[tied]} locale="sr" />);
    expect(screen.getByText("QG")).toBeInTheDocument();
    expect(screen.getByText(/meč 12 : 12 SO/)).toBeInTheDocument();
  });

  it("uses Serbian plural forms for Solo hits", () => {
    render(<ResultsHistoryTable results={[{ ...SOLO_OUT, qualTotal: "21" }, { ...SOLO_OUT, id: 5, rowKey: "r:5", qualTotal: "52" }]} locale="sr" />);
    expect(screen.getByText(/21 hit(?!a|o)/)).toBeInTheDocument();
    expect(screen.getByText(/52 hita/)).toBeInTheDocument();
  });

  it("shows qualification series inline for wide screens", () => {
    render(<ResultsHistoryTable results={[
      { ...result, qualDetail: { series: [105.3, 104.8, 105, 104.1, 105.6, 105.2] } },
      { ...SOLO, competitionId: 2, competitionName: "EP" },
      { ...MIXED, competitionId: 3, competitionName: "Kup" },
    ]} locale="sr" />);
    const lines = screen.getAllByTestId("row-series").map((el) => [...el.children].map((c) => c.textContent).join(" "));
    expect(lines).toContain("105.3 104.8 105.0 104.1 105.6 105.2");
    expect(lines).toContain("K1 26 K2 52");
    expect(lines).toContain("105.1");
  });

  it("expands a mixed team row with both members' series", () => {
    render(<ResultsHistoryTable results={[MIXED]} locale="sr" />);
    fireEvent.click(screen.getByText("10m vazdušna puška miks"));
    expect(screen.getByText("315.2")).toBeInTheDocument();
    expect(screen.getByText("313.9")).toBeInTheDocument();
  });
});
