import { describe, expect, it } from "vitest";
import { mixedTeamMatch } from "./sius-merge";

describe("mixedTeamMatch", () => {
  it("keeps the first match in the main match, as the live feed and the PDF import do", () => {
    expect(mixedTeamMatch(1, 2, "2026-10-23")).toEqual({ eventName: null, eventDate: null });
    expect(mixedTeamMatch(1, 1, "2026-10-23")).toEqual({ eventName: null, eventDate: null });
  });

  it("names a later day as its own match", () => {
    expect(mixedTeamMatch(2, 2, "2026-10-24")).toEqual({ eventName: "2. meč · 24.10.", eventDate: "2026-10-24" });
  });

  it("refuses a repeated event on the same day instead of overwriting the first", () => {
    expect(mixedTeamMatch(2, 1, "2026-10-23")).toBeNull();
  });
});
