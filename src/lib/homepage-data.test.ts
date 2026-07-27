import { describe, expect, it } from "vitest";
import { formatTickerNextTime, getTickerScheduleState, groupTopFormaScores, isCompetitionLive, selectHomepageCurrentPhases, selectTickerUpcoming } from "./homepage-data";
import { getTickerSlotEnd, isTickerSlotLive } from "./ticker-schedule";

describe("selectTickerUpcoming", () => {
  it("keeps only the next two weeks, or falls back to the next three competitions", () => {
    const near = [{ date: "2026-07-20" }, { date: "2026-08-01" }, { date: "2026-08-02" }];
    expect(selectTickerUpcoming(near, "2026-07-18").map(({ date }) => date)).toEqual(["2026-07-20", "2026-08-01"]);
    expect(selectTickerUpcoming([{ date: "2026-08-03" }, { date: "2026-08-04" }, { date: "2026-08-05" }, { date: "2026-08-06" }], "2026-07-18").map(({ date }) => date)).toEqual(["2026-08-03", "2026-08-04", "2026-08-05"]);
  });
});

describe("isCompetitionLive", () => {
  it("marks every day in a multi-day competition as live", () => {
    expect(isCompetitionLive("2026-07-18", "2026-07-22", "2026-07-20")).toBe(true);
    expect(isCompetitionLive("2026-07-18", "2026-07-19", "2026-07-20")).toBe(false);
  });
});

describe("groupTopFormaScores", () => {
  it("keeps the newest-first history separate for every shooter and discipline", () => {
    const scores = groupTopFormaScores([
      { shooterId: 8, discCode: "ARM", qualTotal: "632.4" },
      { shooterId: 8, discCode: "APM", qualTotal: "578" },
      { shooterId: 8, discCode: "ARM", qualTotal: "630.7" },
    ]);

    expect(scores.get("8:ARM")).toEqual([632.4, 630.7]);
    expect(scores.get("8:APM")).toEqual([578]);
  });
});

describe("getTickerScheduleState", () => {
  it("prefers an active phase and still exposes the next and last completed phases", () => {
    const now = new Date("2026-07-21T11:00:00Z");
    const slots = [
      { discCode: "ARM", stage: "qual", startTime: new Date("2026-07-21T08:00:00Z"), endTime: new Date("2026-07-21T10:00:00Z"), name: "ARM qual" },
      { discCode: "ARW", stage: "qual", startTime: new Date("2026-07-21T10:30:00Z"), endTime: new Date("2026-07-21T12:00:00Z"), name: "ARW qual" },
      { discCode: "ARM", stage: "final", startTime: new Date("2026-07-21T13:00:00Z"), endTime: new Date("2026-07-21T14:00:00Z"), name: "ARM final" },
    ];

    expect(getTickerScheduleState(slots, now)).toMatchObject({ active: { name: "ARW qual" }, lastCompleted: { name: "ARM qual" }, next: { name: "ARM final" } });
  });
});

describe("selectHomepageCurrentPhases", () => {
  const at = (hour: number) => new Date(`2026-07-21T${String(hour).padStart(2, "0")}:00:00Z`);
  const phase = (discCode: string, isLive: boolean, hasSrb: boolean, start: number, end: number) => ({ discCode, stage: "qual", isLive, hasSrb, startTime: at(start), endTime: at(end) });

  it("keeps live result phases first and uses Serbian relevance only in the srb scope", () => {
    const phases = [
      phase("ARM", false, false, 8, 10),
      phase("ARW", true, false, 10, 12),
      phase("R3PM", true, true, 9, 11),
      phase("SPW", false, true, 11, 12),
      phase("APM", false, false, 12, 13),
    ];

    expect(selectHomepageCurrentPhases(phases, "srb").map((item) => item.discCode)).toEqual(["R3PM", "ARW", "SPW", "APM"]);
    expect(selectHomepageCurrentPhases(phases, "issf").map((item) => item.discCode)).toEqual(["ARW", "R3PM", "APM", "SPW"]);
  });
});

describe("formatTickerNextTime", () => {
  it("adds tomorrow or a date when the next phase is not today", () => {
    const now = new Date("2026-07-21T10:00:00Z");
    expect(formatTickerNextTime(new Date("2026-07-22T08:00:00Z"), now, "sr")).toMatch(/^sutra u /);
    expect(formatTickerNextTime(new Date("2026-07-30T08:00:00Z"), now, "sr")).toMatch(/jul/);
  });
});

describe("ticker slot defaults", () => {
  it("uses the discipline and phase duration only when an end time is absent", () => {
    const start = new Date("2026-07-21T10:00:00Z");
    const slot = { discCode: "R3PM", stage: "elimination", startTime: start, endTime: null };
    expect(getTickerSlotEnd(slot)?.toISOString()).toBe("2026-07-21T11:45:00.000Z");
    expect(isTickerSlotLive(slot, new Date("2026-07-21T11:30:00Z"))).toBe(true);
    expect(isTickerSlotLive(slot, new Date("2026-07-21T11:46:00Z"))).toBe(false);
  });
});
