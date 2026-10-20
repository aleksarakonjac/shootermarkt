import { render, screen } from "@testing-library/react";
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
  it("shows match points against the opponent in the same match (16:10, 3rd place vs 4th)", () => {
    render(<MixedTeamQualTable teams={[team("SUI", 1, "16.0"), team("NOR", 2, "10.0"), team("FRA", 3, "16.0"), team("GER", 4, "8.0")]} apparatus="air_rifle" stage="final" />);
    expect(screen.getByText(":10")).toBeTruthy(); // 1st vs 2nd
    expect(screen.getByText(":8")).toBeTruthy(); // 3rd vs 4th
    expect(screen.queryByText("16.0")).toBeNull();
  });
});
