import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { commitMixedStages } from "./commitMixedTeams";
import { MixedTeamFinalsTable, MixedTeamQualTable, type MixedTeamEntry } from "./MixedTeamReviewTable";

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

describe("assumed team nation", () => {
  it("lets the admin change or confirm it", () => {
    const onNationChange = vi.fn();
    render(<MixedTeamQualTable entries={[{ ...entry, nocCode: "HUN", nationAssumed: true }]} onToggleSkip={vi.fn()} onNationChange={onNationChange} />);

    expect(screen.getByText(/pretpostavljenom nacijom/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Nacija tima/ }), { target: { value: "svk" } });
    expect(onNationChange).toHaveBeenLastCalledWith(0, "SVK", true);
    fireEvent.click(screen.getByRole("button", { name: "Potvrdi" }));
    expect(onNationChange).toHaveBeenLastCalledWith(0, "HUN", false);
  });

  it("does not commit a team without a nation", async () => {
    const commit = vi.fn().mockResolvedValue({});
    const result = await commitMixedStages([{ ...entry, nocCode: "" }], commit);

    expect(commit).not.toHaveBeenCalled();
    expect(result.errors).toEqual(["Tim bez nacije nije upisan: OSTASHOVA / ARISTARKHOV"]);
  });
});

describe("mixed pair and unranked team", () => {
  it("commits a pair from two countries and shows the DNS mark", async () => {
    const commit = vi.fn().mockResolvedValue({});
    const pair = { ...entry, nocCode: "HUN/GBR", qualRank: null, qualTotal: null, qualRemark: "DNS", finalRank: null };
    await commitMixedStages([pair], commit);
    expect(commit).toHaveBeenCalledTimes(1);

    render(<MixedTeamQualTable entries={[pair]} onToggleSkip={vi.fn()} />);
    expect(screen.getByText("DNS")).toBeInTheDocument();
  });
});
