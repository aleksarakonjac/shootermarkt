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
