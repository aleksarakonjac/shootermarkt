import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MixedTeamFinalsTable, type MixedTeamEntry } from "./MixedTeamReviewTable";

const entry: MixedTeamEntry = {
  skip: false, nocCode: "AIN", teamNumber: 1, disciplineCode: "APMT",
  qualRank: 4, qualTotal: 580, inners: 19, qualified: true, finalRank: 4, finalTotal: 355.1,
  mIssfId: "1", mLastName: "OSTASHOVA", mFirstName: "Angelina", m_series: [], mInners: null, mTotal: 0,
  fIssfId: "2", fLastName: "ARISTARKHOV", fFirstName: "Anton", f_series: [], fInners: null, fTotal: 0,
  mFinalSeries: [47.6, 47.5], fFinalSeries: [50.5, 51.1],
};

describe("MixedTeamFinalsTable", () => {
  it("shows SIUS final series for both team members", () => {
    render(<MixedTeamFinalsTable entries={[entry]} onToggleSkip={vi.fn()} />);

    expect(screen.getByText("S1")).toBeInTheDocument();
    expect(screen.getByText("47.6")).toBeInTheDocument();
    expect(screen.getByText("51.1")).toBeInTheDocument();
  });
});
