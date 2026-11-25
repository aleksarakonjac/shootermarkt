import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PdfMode } from "./PdfMode";

const row = { shooterId: 7, firstName: "Ana", lastName: "ANIC", teamNoc: "SRB", disciplineCode: "ARW", category: "senior", eventName: null, eventDate: null, qualTotal: 628.4, qualRank: 1 };
const job = { id: 1, competitionId: 5, tags: [], status: "completed", error: null, result: { rows: [row], eventsCount: 1, skippedDisciplines: [] } };
const overwrite = { added: 0, changed: 1, same: 0, items: [{ label: "ANIC Ana (SRB) · ARW", status: "changed", changes: ["kvalifikacije"] }] };

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe("PdfMode: zaseban meč", () => {
  it("warns about overwriting and imports the bulletin as a separate match", async () => {
    const bodies: Record<string, { rows: typeof row[] }> = {};
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { body?: string }) => {
      if (init?.body) bodies[url] = JSON.parse(init.body);
      const data = url.endsWith("/jobs/1") ? job
        : url.endsWith("/preview") ? overwrite
        : url.endsWith("/commit") ? { inserted: 1, skipped: 0, errors: [], competitionId: 5 }
        : [];
      return { ok: true, json: async () => data };
    }));
    localStorage.setItem("pdfImportJobId", "1");
    render(<PdfMode />);

    expect(await screen.findByText(/biti prepisani: 1/i, {}, { timeout: 3000 })).toBeInTheDocument();

    const separate = screen.getByRole("checkbox", { name: /zaseban meč/i });
    fireEvent.click(separate);
    fireEvent.click(screen.getByRole("button", { name: /potvrdi i unesi/i }));
    expect(screen.getByText("Svaki dodatni meč mora imati naziv")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Naziv meča"), { target: { value: "Memorijal" } });
    fireEvent.click(screen.getByRole("button", { name: /potvrdi i unesi/i }));
    expect(screen.getByText("Svaki dodatni meč mora imati datum")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Datum meča"), { target: { value: "2026-11-22" } });
    fireEvent.click(separate); // odustajanje vraća redove u glavni meč
    expect(screen.queryByLabelText("Naziv meča")).not.toBeInTheDocument();

    fireEvent.click(separate);
    fireEvent.change(screen.getByLabelText("Naziv meča"), { target: { value: "Memorijal" } });
    fireEvent.change(screen.getByLabelText("Datum meča"), { target: { value: "2026-11-22" } });
    fireEvent.click(screen.getByRole("button", { name: /potvrdi i unesi/i }));

    await waitFor(() => expect(bodies["/api/admin/import/commit"]?.rows[0]).toMatchObject({ eventName: "Memorijal", eventDate: "2026-11-22" }));
  });
});
