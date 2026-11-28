import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReviewRow } from "@shootermarkt/db/pdf-import-types";
import { NewShootersPanel } from "./NewShootersPanel";

const row = (lastName: string, extra: Partial<ReviewRow> = {}) =>
  ({ isNew: true, firstName: "Test", lastName, teamNoc: "HUN", disciplineCode: "ARM", category: "senior", qualTotal: 600, ...extra }) as ReviewRow;

describe("NewShootersPanel — pretpostavljena nacija", () => {
  const rows = [row("Kovacs"), row("Wittmann", { nationAssumed: true, clubAbbr: "APLE" }), row("Somogyi", { nationAssumed: true, clubAbbr: "ZTE" })];

  it("lists assumed shooters first and confirms one", () => {
    const change = vi.fn();
    render(<NewShootersPanel rows={rows} onRowChange={change} />);
    expect(screen.getAllByDisplayValue(/Kovacs|Wittmann|Somogyi/).map((i) => (i as HTMLInputElement).value)).toEqual(["Wittmann", "Somogyi", "Kovacs"]);
    fireEvent.click(screen.getAllByRole("button", { name: "Potvrdi naciju" })[0]);
    expect(change.mock.calls).toEqual([[1, { nationAssumed: false, warning: undefined }]]);
  });

  it("sets one nation for all assumed shooters at once", () => {
    const change = vi.fn();
    render(<NewShootersPanel rows={rows} onRowChange={change} />);
    fireEvent.change(screen.getByLabelText("Nacija za sve pretpostavljene"), { target: { value: "svk" } });
    fireEvent.click(screen.getByRole("button", { name: "Postavi i potvrdi (2)" }));
    expect(change.mock.calls).toEqual([1, 2].map((i) => [i, { teamNoc: "SVK", nationAssumed: false, warning: undefined }]));
  });

  it("confirms the nations as they are when the field is left empty", () => {
    const change = vi.fn();
    render(<NewShootersPanel rows={rows} onRowChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Postavi i potvrdi (2)" }));
    expect(change.mock.calls).toEqual([1, 2].map((i) => [i, { nationAssumed: false, warning: undefined }]));
  });
});

describe("NewShootersPanel — članovi timova", () => {
  it("offers no skip for a person a team will create anyway", () => {
    render(<NewShootersPanel rows={[row("Kovacs"), row("Somogyi"), row("Kovacs")]} onRowChange={vi.fn()} memberFrom={2} />);
    expect(screen.getAllByRole("button", { name: "Preskoči" })).toHaveLength(1);
  });
});
