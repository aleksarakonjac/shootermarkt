import { describe, expect, it } from "vitest";
import { diffSlots, type Slot } from "./schedule-sync";

const s = (h: number, stage = "qual", disciplineId = 1): Slot => ({
  disciplineId, stage, category: "senior", startTime: new Date(Date.UTC(2026, 9, 20, h)), endTime: null,
});

describe("diffSlots", () => {
  it("ignores identical schedules", () => expect(diffSlots([s(8), s(10, "final")], [s(10, "final"), s(8)])).toEqual([]));
  it("detects a moved slot as changed", () => {
    const c = diffSlots([s(8)], [s(9)]);
    expect(c).toEqual([{ kind: "changed", before: s(8), after: s(9) }]);
  });
  it("detects added and removed", () => {
    expect(diffSlots([s(8)], [s(8), s(12, "final")])).toEqual([{ kind: "added", after: s(12, "final") }]);
    expect(diffSlots([s(8), s(12, "final")], [s(8)])).toEqual([{ kind: "removed", before: s(12, "final") }]);
  });
});
