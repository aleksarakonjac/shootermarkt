import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { buildSiusFinalDetails } from "@/lib/final-detail";
import { CompetitionFinalTable, type FinalResultRow } from "./CompetitionFinalTable";

vi.mock("@/i18n/navigation", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

describe("CompetitionFinalTable — 3P final in progress (SIUS position totals)", () => {
  it("shows kneeling and prone totals and a dash for standing not yet shot", () => {
    const [detail] = buildSiusFinalDetails("R3PM", [{ series: [104.3, 104.9], total: 209.2 }]);
    const row: FinalResultRow = {
      id: 1, shooterId: 1, firstName: "Jon-Hermann", lastName: "HEGG", birthYear: null, avatarUrl: null, clubDisplay: "NOR",
      nationality: "NOR", finalTotal: "209.2", finalRank: 1, finalDetail: detail, remark: null,
    } as FinalResultRow;
    render(<CompetitionFinalTable results={[row]} competitionLevel="world" />);

    for (const header of ["Klečeći", "Ležeći", "Stojeći"]) expect(screen.getAllByText(header).length).toBeGreaterThan(0);
    expect(screen.getAllByText("104.3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("104.9").length).toBeGreaterThan(0);
    expect(screen.queryByText("0.0")).not.toBeInTheDocument();
  });
});
