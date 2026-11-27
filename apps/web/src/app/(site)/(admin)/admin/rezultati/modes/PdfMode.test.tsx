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

describe("PdfMode: mešoviti timovi", () => {
  it("shows the teams of the bulletin, checks them against the database and imports them", async () => {
    const team = {
      skip: false, nocCode: "SRB", teamNumber: 1, disciplineCode: "APMT", category: "senior", qualRank: 2, qualTotal: 572, inners: 21, qualified: true, finalRank: 1, finalTotal: 475.7,
      mIssfId: null, mLastName: "Mikec", mFirstName: "Damir", m_series: [100, 96, 98], mInners: 16, mTotal: 294,
      fIssfId: null, fLastName: "Mikec", fFirstName: "Tea", f_series: [96, 89, 93], fInners: 5, fTotal: 278,
    };
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { body?: string }) => {
      if (init?.body) sent.push({ url, body: JSON.parse(init.body) });
      const data = url.endsWith("/jobs/1") ? { ...job, result: { rows: [], eventsCount: 0, skippedDisciplines: [], mixedTeams: [team], warnings: ["Mešoviti tim ARMT: strana nije pročitana"] } }
        : url.endsWith("/preview") ? { added: 1, changed: 0, same: 0, items: [] }
        : url.endsWith("/commit-mixed") ? { inserted: 1, skipped: 0, errors: [], written: ["SRB#1"], updated: [] }
        : [];
      return { ok: true, json: async () => data };
    }));
    localStorage.setItem("pdfImportJobId", "1");
    render(<PdfMode />);

    expect(await screen.findByText("Mešoviti timovi")).toBeInTheDocument();
    // timovi drugog dana se sada uvoze, pa pregled ne sme da savetuje da se preskoče
    expect(screen.queryByText(/čuva samo jedan meč|ove preskoči/)).toBeNull();
    expect(screen.getByText("Mešoviti tim ARMT: strana nije pročitana")).toBeInTheDocument();
    await waitFor(() => expect(sent.find((r) => r.url.endsWith("/preview"))?.body.teams).toHaveLength(1), { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: /potvrdi i unesi 1 rezultat/i }));

    await waitFor(() => expect(sent.filter((r) => r.url.endsWith("/commit-mixed")).map((r) => r.body.isFinals)).toEqual([false, true]));
    expect(sent.some((r) => r.url === "/api/admin/import/commit")).toBe(false);
    expect(await screen.findByText(/rezultata uneto/)).toBeInTheDocument();
  });
});


describe("PdfMode: zaseban meč za timove", () => {
  it("lets the teams have their own match name and date", async () => {
    const individual = { ...row, eventName: "Salona Trophy 2026", eventDate: "2026-10-24", fromMain: true };
    const team = {
      skip: false, nocCode: "SRB", teamNumber: 1, disciplineCode: "APMT", category: "senior", eventName: null, eventDate: "2026-10-23",
      qualRank: 2, qualTotal: 572, inners: 21, qualified: true, finalRank: 1, finalTotal: 475.7,
      mIssfId: null, mLastName: "Mikec", mFirstName: "Damir", m_series: [100, 96, 98], mInners: 16, mTotal: 294,
      fIssfId: null, fLastName: "Mikec", fFirstName: "Tea", f_series: [96, 89, 93], fInners: 5, fTotal: 278,
    };
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { body?: string }) => {
      if (init?.body) sent.push({ url, body: JSON.parse(init.body) });
      const data = url.endsWith("/jobs/1") ? { ...job, result: { rows: [individual], eventsCount: 1, skippedDisciplines: [], mixedTeams: [team] } }
        : url.endsWith("/preview") ? { added: 2, changed: 0, same: 0, items: [] }
        : url.endsWith("/commit") ? { inserted: 1, skipped: 0, errors: [], competitionId: 5 }
        : url.endsWith("/commit-mixed") ? { inserted: 1, skipped: 0, errors: [], written: ["SRB#1"], updated: [] }
        : [];
      return { ok: true, json: async () => data };
    }));
    localStorage.setItem("pdfImportJobId", "1");
    render(<PdfMode />);

    const separate = await screen.findByRole("checkbox", { name: /mešoviti timovi su zaseban meč/i }, { timeout: 3000 });
    expect(screen.getByText(/timovi idu u glavni meč/i)).toBeInTheDocument();
    fireEvent.click(separate);
    expect(screen.getByLabelText("Naziv meča timova")).toHaveValue("Salona Trophy 2026 · mešoviti timovi");
    expect(screen.getByLabelText("Datum meča timova")).toHaveValue("2026-10-23");

    fireEvent.change(screen.getByLabelText("Naziv meča timova"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /potvrdi i unesi/i }));
    expect(screen.getByText("Svaki dodatni meč mora imati naziv")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Naziv meča timova"), { target: { value: "Salona Trophy 2026 · mešoviti timovi" } });
    fireEvent.click(screen.getByRole("button", { name: /potvrdi i unesi/i }));

    await waitFor(() => expect(sent.filter((r) => r.url.endsWith("/commit-mixed"))).toHaveLength(2));
    for (const call of sent.filter((r) => r.url.endsWith("/commit-mixed"))) {
      expect(call.body).toMatchObject({ eventName: "Salona Trophy 2026 · mešoviti timovi", eventDate: "2026-10-23" });
    }
  });
});

describe("PdfMode: naziv meča timova", () => {
  it("refuses a team match named like the individual match but on another day", async () => {
    const individual = { ...row, eventName: "Salona Trophy 2026", eventDate: "2026-10-24", fromMain: true };
    const team = {
      skip: false, nocCode: "SRB", teamNumber: 1, disciplineCode: "APMT", category: "senior", eventName: null, eventDate: "2026-10-23",
      qualRank: 2, qualTotal: 572, inners: 21, qualified: true, finalRank: null, finalTotal: null,
      mIssfId: null, mLastName: "Mikec", mFirstName: "Damir", m_series: [], mInners: null, mTotal: 294,
      fIssfId: null, fLastName: "Mikec", fFirstName: "Tea", f_series: [], fInners: null, fTotal: 278,
    };
    const sent: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: { body?: string }) => {
      if (init?.body) sent.push(url);
      const data = url.endsWith("/jobs/1") ? { ...job, result: { rows: [individual], eventsCount: 1, skippedDisciplines: [], mixedTeams: [team] } }
        : url.endsWith("/preview") ? { added: 2, changed: 0, same: 0, items: [] }
        : [];
      return { ok: true, json: async () => data };
    }));
    localStorage.setItem("pdfImportJobId", "1");
    render(<PdfMode />);

    fireEvent.click(await screen.findByRole("checkbox", { name: /mešoviti timovi su zaseban meč/i }, { timeout: 3000 }));
    fireEvent.change(screen.getByLabelText("Naziv meča timova"), { target: { value: "Salona Trophy 2026" } });
    fireEvent.click(screen.getByRole("button", { name: /potvrdi i unesi/i }));

    expect(screen.getByText(/meč „Salona Trophy 2026“ već ima datum 24\.10\.2026\./i)).toBeInTheDocument();
    expect(sent.some((url) => url.endsWith("/commit") || url.endsWith("/commit-mixed"))).toBe(false);
  });
});

