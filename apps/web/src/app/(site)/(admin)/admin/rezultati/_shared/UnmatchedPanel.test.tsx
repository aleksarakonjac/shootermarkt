import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReviewRow } from "@shootermarkt/db/pdf-import-types";
import { UnmatchedPanel } from "./UnmatchedPanel";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const row = (lastName: string, issfId?: string) =>
  ({ lastName, firstName: "Test", teamNoc: "CAN", disciplineCode: "ARW", issfId }) as ReviewRow;

function Harness({ initial = [row("ZHANG")] }: { initial?: ReviewRow[] }) {
  const [rows, setRows] = useState(initial);
  return (
    <UnmatchedPanel
      rows={rows}
      onRowChange={(idx, patch) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))}
    />
  );
}

it("keeps a handled shooter visible with its outcome", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Isključi" }));
  fireEvent.click(screen.getByRole("button", { name: "Primeni →" }));
  expect(screen.getByText("✓ Isključen")).toBeInTheDocument();
  expect(screen.getByText("1/1 obrađeno")).toBeInTheDocument();
});

it("bulk ISSF import keeps a shooter ISSF does not know, with the error", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const { issfId } = JSON.parse(init.body as string);
    return issfId === "SHOK"
      ? Response.json({ shooter: { id: 7, firstName: "Ok", lastName: "FOUND", nationality: "CAN" } })
      : Response.json({ error: "ISSF nema strelca" }, { status: 404 });
  }));
  render(<Harness initial={[row("FOUND", "SHOK"), row("MISSING", "SHNO")]} />);
  fireEvent.click(screen.getByLabelText("Izaberi sve"));
  fireEvent.click(screen.getByRole("button", { name: "⬇ Preuzmi sa ISSF (2)" }));

  expect(await screen.findByText("ISSF greška: Error: ISSF nema strelca")).toBeInTheDocument();
  expect(screen.getByText("✓ Uvezen sa ISSF (ID 7)")).toBeInTheDocument();
  expect(screen.getByText("1/2 obrađeno")).toBeInTheDocument();
});
