import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MixedTeamQualTable, type MixedTeamRow } from "./MixedTeamQualTable";

vi.mock("next-intl", () => ({ useLocale: () => "sr" }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

const team = (nocCode: string, finalRank: number, finalTotal: string): MixedTeamRow => ({
  id: finalRank, nocCode, teamNumber: 1, shooter1Id: null, shooter2Id: null, shooter1Name: "A", shooter2Name: "B",
  shooter1Detail: null, shooter2Detail: null,
  shooter1FinalDetail: { series: [10.4, 10.6] }, shooter2FinalDetail: { series: [10.1, 10.9] },
  qualRank: null, qualTotal: null, qualInners: null, qualRemark: null, qualified: true, finalRank, finalTotal, finalRemark: null,
});

describe("MixedTeamQualTable — 2025 medal match final", () => {
  it("shows only the team's own match points", () => {
    render(<MixedTeamQualTable teams={[team("SUI", 1, "16.0"), team("NOR", 2, "10.0")]} apparatus="air_rifle" stage="final" />);
    expect(screen.getByText("16")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.queryByText(":10")).toBeNull();
  });

  it("bolds the rounds a team won or tied, by comparing both shooters' summed shots", () => {
    const winner = { ...team("SUI", 1, "16.0"), shooter1FinalDetail: { series: [10.9, 10.0] }, shooter2FinalDetail: { series: [10.8, 10.0] } };
    const loser = { ...team("NOR", 2, "10.0"), shooter1FinalDetail: { series: [10.1, 10.0] }, shooter2FinalDetail: { series: [10.2, 10.0] } };
    render(<MixedTeamQualTable teams={[winner, loser]} apparatus="air_rifle" stage="final" />);
    for (const row of screen.getAllByRole("row")) fireEvent.click(row);
    // runda 1: SUI 21.7 > NOR 20.3 (samo SUI boldovan); runda 2: 20.0 = 20.0 (oba boldovana)
    expect(screen.getAllByText("21.7")[0].className).toContain("font-semibold");
    expect(screen.getAllByText("20.3")[0].className).not.toContain("font-semibold");
    for (const el of screen.getAllByText("20.0")) expect(el.className).toContain("font-semibold");
  });
});
