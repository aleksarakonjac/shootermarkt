import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CompetitionQualTable, type CompResultRow } from "./CompetitionQualTable";

vi.mock("next-intl", () => ({ useLocale: () => "sr" }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

const row = (id: number, rank: number, lastName: string): CompResultRow =>
  ({ id, shooterId: id, firstName: "Ana", lastName, birthYear: null, clubDisplay: "SRB", nationality: "SRB", qualTotal: String(560 - rank), qualRank: rank, qualInners: null, qualified: null, qualDetail: null, remark: null, disciplineCode: "FPM" }) as CompResultRow;
const rows = [row(1, 1, "ONE"), row(2, 2, "TWO"), row(3, 3, "THREE"), row(4, 4, "FOUR")];

describe("CompetitionQualTable — medals for disciplines without a final", () => {
  it("shows gold, silver and bronze circles for the top three when enabled", () => {
    render(<CompetitionQualTable results={rows} competitionLevel="world" showMedals />);
    for (const place of [1, 2, 3]) expect(screen.getByLabelText(`Mesto ${place}`)).toBeInTheDocument();
    expect(screen.queryByLabelText("Mesto 4")).not.toBeInTheDocument();
  });

  it("shows no medal circles by default", () => {
    render(<CompetitionQualTable results={rows} competitionLevel="world" />);
    expect(screen.queryByLabelText("Mesto 1")).not.toBeInTheDocument();
  });
});
