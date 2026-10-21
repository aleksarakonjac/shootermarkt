import { describe, expect, it } from "vitest";
import { computeForma } from "./forma";

describe("computeForma", () => {
  it("reduces the influence of lower age-category results without changing their score", () => {
    const sharedEntries = [
      { score: 600, date: "2026-01-01", level: "national" as const },
      { score: 630, date: "2026-02-01", level: "national" as const },
      { score: 630, date: "2026-03-01", level: "national" as const },
    ];

    const withJuniorResult = computeForma([
      { ...sharedEntries[0], category: "junior" },
      { ...sharedEntries[1], category: "senior" },
      { ...sharedEntries[2], category: "senior" },
    ]);
    const allSenior = computeForma(sharedEntries.map((entry) => ({ ...entry, category: "senior" })));

    expect(withJuniorResult.level).toBeGreaterThan(allSenior.level!);
    expect(withJuniorResult.peak).toBe(630);
  });
});

describe("computeForma v2", () => {
  const series = (scores: number[]) =>
    scores.map((score, i) => ({ score, date: `2026-${String(i + 1).padStart(2, "0")}-01`, level: "national" as const, category: "senior" as const }));

  it("never exceeds the personal peak, even on a steep rising series", () => {
    const r = computeForma(series([570, 575, 580, 585, 590, 595, 598]), { code: "R3PM" });
    expect(r.forma!).toBeLessThanOrEqual(598);
    expect(r.trend).toBe("up");
  });

  it("ignores DNF-like zeros and counts the same match listed twice only once", () => {
    const base = series([620, 621, 622, 623, 624]);
    const dup = [...base, { ...base[4], category: "junior" as const }, { score: 0, date: "2026-06-01" }];
    const r = computeForma(dup, { code: "ARM" });
    expect(r.sampleSize).toBe(5);
    expect(r.forma).toBeCloseTo(computeForma(base, { code: "ARM" }).forma!, 6);
  });

  it("dampens a single bad outlier", () => {
    const clean = computeForma(series([620, 621, 620, 622, 621, 620]), { code: "ARM" });
    const withBad = computeForma(series([620, 621, 600, 622, 621, 620]), { code: "ARM" });
    expect(clean.forma! - withBad.forma!).toBeLessThan(2);
  });
});
