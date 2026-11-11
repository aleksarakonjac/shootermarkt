import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { buildSiusFinalDetails } from "@/lib/final-detail";
import { CompetitionFinalTable, type FinalResultRow } from "./CompetitionFinalTable";

vi.mock("next-intl", () => ({ useLocale: () => "sr" }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

describe("CompetitionFinalTable — 3P final in progress (SIUS position totals)", () => {
  it("shows the running cumulative per position, like the ISSF site", () => {
    const [detail] = buildSiusFinalDetails("R3PM", [{ series: [104.3, 104.9] }]);
    const row: FinalResultRow = {
      id: 1, shooterId: 1, firstName: "Jon-Hermann", lastName: "HEGG", birthYear: null, avatarUrl: null, clubDisplay: "NOR",
      nationality: "NOR", finalTotal: "209.2", finalRank: 1, finalDetail: detail, remark: null,
    } as FinalResultRow;
    render(<CompetitionFinalTable results={[row]} competitionLevel="world" />);

    for (const header of ["Klečeći", "Ležeći"]) expect(screen.getAllByText(header).length).toBeGreaterThan(0);
    expect(screen.getAllByText("104.3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("209.2").length).toBeGreaterThan(0);
  });
});

describe("CompetitionFinalTable — olympic quota marker", () => {
  const base = { shooterId: 1, firstName: "Ana", lastName: "KOVAC", birthYear: null, avatarUrl: null, clubDisplay: "SRB", nationality: "SRB", finalTotal: "250.0", finalDetail: null, remark: null, disciplineCode: "ARW" };
  const rows = [{ ...base, id: 1, finalRank: 1, olympicQuota: true }, { ...base, id: 2, shooterId: 2, lastName: "NOVAK", finalRank: 2 }] as FinalResultRow[];

  it("marks only the quota winner, and a click explains the quota", () => {
    render(<CompetitionFinalTable results={rows} competitionLevel="world" />);

    const marks = screen.getAllByRole("button", { name: /kvota za LA 2028/i });
    expect(marks).toHaveLength(1);

    fireEvent.click(marks[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("Osvojena kvota za LA 2028");
    expect(screen.getByRole("dialog")).toHaveTextContent("Osvojena kvota za Srbiju: Ana KOVAC (ARW)");
  });

  it("closing the quota message does not expand the row underneath", () => {
    const [detail] = buildSiusFinalDetails("R3PM", [{ series: [104.3, 104.9] }]);
    const row = { ...base, id: 3, finalRank: 1, finalDetail: detail, olympicQuota: true } as FinalResultRow;
    render(<CompetitionFinalTable results={[row]} competitionLevel="world" />);

    fireEvent.click(screen.getByRole("button", { name: /kvota za LA 2028/i }));
    fireEvent.click(screen.getByRole("button", { name: "Zatvori" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Prikaži sve serije")).toBeInTheDocument();
  });
});
