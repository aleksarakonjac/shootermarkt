import { describe, expect, it } from "vitest";
import type { ISSFScheduleEntry } from "@shootermarkt/adapters/issf/adapter";
import { diffSlots, entriesToExtras, entriesToSlots, type Slot } from "./schedule-sync";

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

const entry = (eventTitle: string, disciplineCode: string | null, stage: ISSFScheduleEntry["stage"], startTime = "09:00"): ISSFScheduleEntry => ({
  date: "2026-11-02", dayLabel: "Monday - 02 NOV", startTime, endTime: null, eventTitle, disciplineCode, stage, isTraining: false, isFinal: stage === "final", isMedal: false, relay: null,
});
const ids = { ARM: 1, FPM: 2 };

describe("entriesToExtras", () => {
  const entries = [
    entry("Pre-event Training 10m Air Rifle Men", "ARM", "training", "08:00"),
    entry("Unofficial Training 50m Pistol Men", "FPM", "training", "10:00"),
    entry("Medal Ceremony ARM", null, "ceremony", "12:00"),
    entry("Equipment Control", null, "qual", "07:00"),
    entry("Trap Women 50 Targets", null, "qual", "09:00"),
    entry("Pre-event Training Trap Men 50 Targets", null, "training", "09:00"),
    entry("10m Air Rifle Men Relay 1", "ARM", "qual", "09:00"),
  ];

  it("keeps training, ceremonies and other items, but not competition slots or shotgun", () => {
    const extras = entriesToExtras(entries, "Asia/Qatar", ids);
    expect(extras.map((x) => [x.kind, x.title])).toEqual([
      ["training", "Pre-event Training 10m Air Rifle Men"],
      ["training", "Unofficial Training 50m Pistol Men"],
      ["ceremony", "Medal Ceremony ARM"],
      ["other", "Equipment Control"],
    ]);
  });

  it("links a training to its discipline when known", () => {
    expect(entriesToExtras(entries, "Asia/Qatar", ids)[0].disciplineId).toBe(1);
  });

  it("does not duplicate the same title at the same time", () => {
    expect(entriesToExtras([...entries, ...entries], "Asia/Qatar", ids)).toHaveLength(4);
  });

  it("never turns training into a competition slot", () => {
    expect(entriesToSlots(entries, "Asia/Qatar", ids).map((x) => x.stage)).toEqual(["qual"]);
  });
});
