import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShooterResultsArchive } from "./ShooterResultsArchive";
import type { ResultRowData } from "./ResultsHistoryTable";

const result: ResultRowData = {
  id: 1, competitionId: 1, competitionName: "Kup Srbije", competitionDate: "2026-07-29", competitionDateEnd: null, competitionLocation: null,
  competitionCountry: null, competitionCountryCode2: null, disciplineCode: "ARM", category: "senior",
  qualTotal: "630.0", qualRank: 5, qualInners: null, qualified: true,
  elimTotal: null, elimRank: null, elimRound: null, elimDetail: null, finalTotal: null, finalRank: null, qualDetail: null, finalDetail: null,
};

describe("ShooterResultsArchive", () => {
  it("loads the next competition page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ ...result, id: 2, competitionId: 2, competitionName: "Državno prvenstvo" }], nextCursor: null }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ShooterResultsArchive shooterId={7} initialResults={[result]} initialCursor={{ date: "2026-07-29", id: 1 }} allLabel="Sve" loadMoreLabel="Prikaži još" loadingLabel="Učitavanje…" searchPlaceholder="Pretraži" dateLabel="Datum" fromLabel="Od" toLabel="Do" applyDateLabel="Primeni" dateDaysLabel="Dani" dateMonthsLabel="Meseci" dateYearsLabel="Godine" clearDateLabel="Obriši" emptyLabel="Nema rezultata" locale="sr" />);

    fireEvent.click(screen.getByRole("button", { name: "Prikaži još" }));

    await waitFor(() => expect(screen.getByText("Državno prvenstvo")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/shooters/7/results?date=2026-07-29&id=1");
    expect(screen.queryByRole("button", { name: "Prikaži još" })).not.toBeInTheDocument();
  });
});
