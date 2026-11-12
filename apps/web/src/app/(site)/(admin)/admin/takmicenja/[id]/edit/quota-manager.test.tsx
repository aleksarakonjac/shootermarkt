import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuotaManager } from "./quota-manager";

afterEach(() => vi.unstubAllGlobals());

const cand = (resultId: number, lastName: string, rank: number, extra: object = {}) => ({
  resultId, firstName: "Ana", lastName, nationality: "SRB", rank, fromQualification: false, quota: false, qualTotal: 600, belowMqs: false, ...extra,
});
const data = {
  disciplines: [{
    disciplineId: 1, code: "ARM", name: "Air Rifle Men", places: 3, basis: "final", nocCounts: [],
    candidates: [
      cand(1, "FINALIST", 1),
      cand(2, "HOLDER", 12, { fromQualification: true, quota: true }),
      cand(3, "QUALONLY", 9, { fromQualification: true }),
      cand(4, "LOWSCORE", 10, { fromQualification: true, qualTotal: 600.5, belowMqs: true }),
    ],
  }],
  available: [],
};

function mockFetch() {
  const calls: Array<{ method: string; body: unknown }> = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
    return { ok: true, json: async () => (init?.method ? { ok: true } : data) } as Response;
  }));
  return calls;
}

describe("QuotaManager", () => {
  it("lists finalists and holders, and offers other qualification shooters only through search", async () => {
    mockFetch();
    render(<QuotaManager competitionId={13} />);
    await screen.findByText("FINALIST", { exact: false });

    expect(screen.getByText("HOLDER", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("QUALONLY", { exact: false })).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);

    const search = screen.getByLabelText("Dodaj iz kvalifikacija");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "qual" } });
    expect(screen.getByText("QUALONLY", { exact: false })).toBeInTheDocument();
  });

  it("assigns a quota to the picked qualification shooter, but not one below the MQS", async () => {
    const calls = mockFetch();
    render(<QuotaManager competitionId={13} />);
    await screen.findByText("FINALIST", { exact: false });

    const search = screen.getByLabelText("Dodaj iz kvalifikacija");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByRole("button", { name: /LOWSCORE/ })).toBeDisabled();

    fireEvent.mouseDown(screen.getByRole("button", { name: /QUALONLY/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && JSON.stringify(c.body) === JSON.stringify({ resultId: 3, quota: true }))).toBe(true));
  });
});
