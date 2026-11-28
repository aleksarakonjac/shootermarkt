import { describe, expect, it } from "vitest";
import { buildSiusFinalDetails } from "./final-detail";
import { hasNoFinalMark, noFinalKey, shouldShowFinalMedals, shouldShowQualMedals } from "./final-medals";

const at = (iso: string) => new Date(iso);
const slot = { startTime: "2026-10-15T10:00:00Z", endTime: "2026-10-15T10:45:00Z" };

describe("shouldShowFinalMedals", () => {
  it("hides medals while the final is running per schedule, including a 10 min overrun", () => {
    expect(shouldShowFinalMedals(slot, [], at("2026-10-15T10:20:00Z"))).toBe(false);
    expect(shouldShowFinalMedals(slot, [], at("2026-10-15T10:54:00Z"))).toBe(false);
  });

  it("shows medals after the scheduled end plus overrun, or without a schedule", () => {
    expect(shouldShowFinalMedals(slot, [], at("2026-10-15T10:56:00Z"))).toBe(true);
    expect(shouldShowFinalMedals(undefined, [], at("2026-10-15T10:20:00Z"))).toBe(true);
  });

  it("shows medals for a SIUS 3P final once the top two have all 5 single shots, even mid-slot", () => {
    const series = (singles: number) => [104, 104, 51, 51, ...Array.from({ length: singles }, () => 10.2)];
    const unfinished = buildSiusFinalDetails("R3PM", [{ series: series(4) }, { series: series(4) }, { series: series(4) }]);
    const finished = buildSiusFinalDetails("R3PM", [{ series: series(5) }, { series: series(5) }, { series: series(4) }]);
    expect(shouldShowFinalMedals(slot, unfinished, at("2026-10-15T10:30:00Z"))).toBe(false);
    expect(shouldShowFinalMedals(slot, finished, at("2026-10-15T10:30:00Z"))).toBe(true);
  });
});

describe("bez finala", () => {
  const slot = (start: string, end: string) => ({ startTime: start, endTime: end });
  const relays = [slot("2026-01-01T09:00:00Z", "2026-01-01T10:00:00Z"), slot("2026-01-01T12:00:00Z", "2026-01-01T13:00:00Z")];

  it("medalje tek posle poslednje partije; bez satnice odmah", () => {
    expect(shouldShowQualMedals(relays, new Date("2026-01-01T11:00:00Z"))).toBe(false);
    expect(shouldShowQualMedals(relays, new Date("2026-01-01T13:30:00Z"))).toBe(true);
    expect(shouldShowQualMedals([])).toBe(true);
  });

  it("ključ nosi meč, a kartica ga prepoznaje u bilo kom meču iste kategorije", () => {
    expect(noFinalKey("ARM", null, "senior")).toBe("ARM|senior");
    expect(noFinalKey("ARM", 12, "senior")).toBe("ARM@12|senior");
    expect(hasNoFinalMark(["ARM@12|senior"], "ARM", "senior")).toBe(true);
    expect(hasNoFinalMark(["ARM|junior"], "ARM", "senior")).toBe(false);
  });
});
