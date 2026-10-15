import { describe, expect, it } from "vitest";
import { buildSiusFinalDetails } from "./final-detail";
import { shouldShowFinalMedals } from "./final-medals";

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
