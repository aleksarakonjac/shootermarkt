import { describe, expect, it } from "vitest";
import { matchSiusCompetition } from "./sius-match";

const sius = [
  { id: "a", name: "ISSF World Cup Rifle & Pistol", city: "Granada", country: "ESP", start: "2026-04-04", end: "2026-04-14" },
  { id: "b", name: "National Intercollegiate Athletic Games", city: "Taoyuan", country: "TPE", start: "2026-04-05", end: "2026-04-09" },
];

describe("matchSiusCompetition", () => {
  it("links the same event confidently", () => {
    const m = matchSiusCompetition({ name: "ISSF World Cup Rifle / Pistol", date: "2026-04-05", location: "Granada" }, sius);
    expect(m).toMatchObject({ id: "a", confident: true });
  });
  it("does not auto-link an unrelated domestic event", () => {
    const m = matchSiusCompetition({ name: "Finale Kupa SSS, B program, 10m", date: "2026-04-04" }, sius);
    expect(m?.confident).toBe(false);
  });
  it("skips UUIDs already taken", () => {
    const m = matchSiusCompetition({ name: "ISSF World Cup Rifle / Pistol", date: "2026-04-05", location: "Granada" }, sius, new Set(["a"]));
    expect(m?.id).toBe("b");
    expect(m?.confident).toBe(false);
  });
});
