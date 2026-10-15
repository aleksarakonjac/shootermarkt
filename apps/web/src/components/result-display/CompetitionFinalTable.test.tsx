import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { buildSiusFinalDetails } from "@/lib/final-detail";
import { CompetitionFinalTable, type FinalResultRow } from "./CompetitionFinalTable";

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
