import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { mergeEscSoloPhases, type SiusLiveResult } from "@shootermarkt/adapters/sius/public-adapter";
import fixture from "../../../../../packages/adapters/src/sius/__fixtures__/esc-solo-arm-vroclav.json";
import { escSoloReviewRows } from "@/lib/sius-merge";
import { EscSoloResults, type EscSoloRow } from "./EscSoloResults";

vi.mock("@/i18n/navigation", () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));

// Fixture (sirovi SIUS) → isti tok kao uvoz → redovi kakve stranica takmičenja čita iz `results`.
type RawRow = { Rank?: { DisplayText: string }; DisplayName?: string; Nation?: string; Result?: { Value: string; Extensions?: Array<{ Key: string; Value: string }> }; AthletesSeries?: Array<{ AthleteIdentifier?: { Identifier?: string }; TotalScore?: number; Series?: Array<Array<{ Value: string }>> }> };
const toLive = (raw: unknown): SiusLiveResult[] => {
  const data = (Array.isArray(raw) ? raw[0] : raw) as { "Series-Individual"?: RawRow[] };
  return (data["Series-Individual"] ?? []).map((r) => {
    const [lastName, ...first] = (r.DisplayName ?? "").split(" ");
    const ext = Object.fromEntries((r.Result?.Extensions ?? []).map((e) => [e.Key, e.Value]));
    const rank = parseInt(r.Rank?.DisplayText ?? "", 10);
    return {
      rank: isNaN(rank) ? null : rank, displayName: r.DisplayName ?? "", firstName: first.join(" "), lastName: lastName ?? "", nation: r.Nation ?? "",
      total: r.AthletesSeries?.[0]?.TotalScore ?? parseFloat(r.Result?.Value ?? "0"), inners: null,
      series: (r.AthletesSeries?.[0]?.Series ?? []).flat().map((s) => parseFloat(s.Value)),
      siusAthleteId: r.AthletesSeries?.[0]?.AthleteIdentifier?.Identifier ?? null,
      qualified: ext.QualificationRemark === "Q", remark: ext.StatusRemark ?? null, qualificationRemark: ext.QualificationRemark ?? null,
      penalty: null, shootOff: ext.ShootOffRemark ?? null, record: null,
    };
  });
};
const athletes = mergeEscSoloPhases({ part1: toLive(fixture.part1), part2: toLive(fixture.part2), gold: toLive(fixture.gold), bronze: toLive(fixture.bronze) });
const VROCLAV_ROWS: EscSoloRow[] = escSoloReviewRows(athletes, "SOLOARM", "senior", () => 1).map((row, i) => ({
  id: i + 1, shooterId: i + 1, firstName: row.firstName, lastName: row.lastName, nationality: row.teamNoc,
  qualTotal: row.qualTotal != null ? String(row.qualTotal) : null, qualRank: row.qualRank ?? null, qualDetail: row.qualEscSolo ?? null,
  finalTotal: row.finalTotal != null ? String(row.finalTotal) : null, finalRank: row.finalRank ?? null,
  finalDetail: row.finalTotal != null ? { format: "bulletin", scoring: "hit_count", series: row.finalSeries ?? [], opponentTotal: row.finalOpponentTotal, opponentName: row.finalOpponentName } : null,
  remarkDetails: row.remarkDetails ?? null,
}));

describe("EscSoloResults", () => {
  it("shows medal matches, then qualification 2 and qualification 1", () => {
    render(<EscSoloResults results={VROCLAV_ROWS} disciplineCode="SOLOARM" locale="sr" />);
    expect(screen.getByText("Hit: 10.3 i više")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mečevi za medalju" })).toBeInTheDocument();
    expect(within(screen.getByTestId("gold-match")).getByText("12 : 10")).toBeInTheDocument();
    expect(within(screen.getByTestId("bronze-match")).getByText("11 : 9")).toBeInTheDocument();
    expect(within(screen.getByTestId("qual2")).getAllByRole("row")).toHaveLength(18 + 1);
    expect(within(screen.getByTestId("qual1")).getAllByRole("row")).toHaveLength(31 + 1);
    expect(within(screen.getByTestId("qual2")).getAllByText("QG")).toHaveLength(2);
  });

  it("marks a shoot-off even when only the loser row carries it", () => {
    const winner: EscSoloRow = { ...VROCLAV_ROWS[0], id: 101, finalTotal: "12", finalRank: 1, remarkDetails: null };
    const loser: EscSoloRow = { ...VROCLAV_ROWS[1], id: 102, finalTotal: "12", finalRank: 2, remarkDetails: { final: { shootOff: "SO" } } };
    render(<EscSoloResults results={[winner, loser]} disciplineCode="SOLOARM" locale="sr" />);
    expect(within(screen.getByTestId("gold-match")).getByText("12 : 12 SO")).toBeInTheDocument();
  });

  it("uses the pistol hit threshold for air pistol Solo", () => {
    render(<EscSoloResults results={[]} disciplineCode="SOLOAPW" locale="en" />);
    expect(screen.getByText("Hit: 9.8 or higher")).toBeInTheDocument();
  });
});
