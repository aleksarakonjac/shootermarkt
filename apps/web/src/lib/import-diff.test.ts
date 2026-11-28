import { describe, expect, it } from "vitest";
import type { ReviewRow } from "@shootermarkt/db/pdf-import-types";
import { changedColumns, changedParts, matchDateConflicts, resultColumns, summarizeDiff, upsertedResult } from "./import-diff";

const ROW: ReviewRow = {
  shooterId: 1, firstName: "Petar", lastName: "PETROVIC", teamNoc: "SRB", disciplineCode: "ARM", category: "senior",
  qualTotal: 630, qualRank: 3, qualSeries: [105, 105, 105, 105, 105, 105], qualified: true,
  finalTotal: 251.2, finalRank: 1, finalSeries: [52.1, 51.9],
  remarkDetails: { final: { record: "NR" } },
};
/** Red kakav baza vraća: decimale kao stringovi, jsonb sa drugim redosledom ključeva. */
const STORED = {
  ...resultColumns(ROW),
  clubId: 9, qualTotal: "630.0", finalTotal: "251.2",
  finalDetail: { series: [52.1, 51.9], scoring: "decimal", format: "bulletin" },
};
const diff = (row: ReviewRow, old: Record<string, unknown> = STORED) =>
  changedColumns(old, upsertedResult(old, { ...resultColumns(row), clubId: null }, row.elimRound != null && row.qualTotal == null));

describe("import diff", () => {
  it("treats a re-import of the same results as unchanged", () => {
    expect(diff(ROW)).toEqual([]);
  });

  it("keeps values the import does not carry: club, Q, eliminations, other stage marks", () => {
    const old = { ...STORED, elimRound: 1, elimTotal: 580, remarkDetails: { qual: { penalty: "-2" }, final: { record: "NR" } } };
    expect(diff({ ...ROW, qualified: null }, old)).toEqual([]);
  });

  it("names the parts that differ", () => {
    expect(changedParts(diff({ ...ROW, finalTotal: 251.3 }))).toEqual(["finale"]);
    expect(changedParts(diff({ ...ROW, qualRank: 4, remarkDetails: { qual: { penalty: "-1" } } }))).toEqual(["kvalifikacije", "oznake"]);
  });

  it("sees a final that is not in the database yet", () => {
    const qualOnly = { ...STORED, finalTotal: null, finalRank: null, finalDetail: null, remarkDetails: null };
    expect(changedParts(diff(ROW, qualOnly))).toEqual(["finale", "oznake"]);
  });

  it("compares only elimination columns for an elimination-only row", () => {
    const elim: ReviewRow = { ...ROW, qualTotal: null, qualRank: undefined, elimRound: 1, elimTotal: 580, elimRank: 5, remarkDetails: undefined };
    const old = { ...STORED, ...upsertedResult(STORED, resultColumns(elim), true) };
    expect(diff(elim, old)).toEqual([]);
  });

  it("counts new, changed and unchanged rows", () => {
    expect(summarizeDiff([
      { label: "a", status: "new", changes: [] },
      { label: "b", status: "changed", changes: ["finale"] },
      { label: "c", status: "same", changes: [] },
    ])).toMatchObject({ added: 1, changed: 1, same: 1, items: [{ label: "a" }, { label: "b" }] });
  });
});

describe("matchDateConflicts", () => {
  const events = [{ name: "Grand Prix Smederevo", date: "2026-11-27" }];
  const entry = (eventName: string | null, eventDate: string | null) => ({ eventName, eventDate });

  it("reports an existing match name entered with another date, once", () => {
    const rows = [entry(" Grand Prix Smederevo ", "2026-11-28"), entry("Grand Prix Smederevo", "2026-11-28")];
    expect(matchDateConflicts(events, rows)).toEqual([{ name: "Grand Prix Smederevo", existing: "2026-11-27", entered: "2026-11-28" }]);
  });

  it("stays quiet for the same date, a new name, the main match or a missing date", () => {
    expect(matchDateConflicts(events, [entry("Grand Prix Smederevo", "2026-11-27"), entry("Grand Prix Smederevo · 28.11.", "2026-11-28"), entry(null, "2026-11-28"), entry("Grand Prix Smederevo", null)])).toEqual([]);
  });
});
