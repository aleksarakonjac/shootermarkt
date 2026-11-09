import { describe, expect, it } from "vitest";
import { disciplineName } from "./discipline-names";

describe("disciplineName", () => {
  it("returns catalog names without gender by default", () => {
    expect(disciplineName("ARW", "sr")).toBe("10m vazdušna puška");
    expect(disciplineName("ARW", "en")).toBe("10m Air Rifle");
    expect(disciplineName("APMT", "sr")).toBe("10m vazdušni pištolj miks");
    expect(disciplineName("R3PM", "sr", { variant: "3x20" })).toBe("50m puška 3x20");
    expect(disciplineName("R3PM", "en")).toBe("50m Rifle 3x40");
    expect(disciplineName("RFPM", "sr")).toBe("25m Rapid Fire pištolj");
    expect(disciplineName("SOLOAPW", "en")).toBe("10m Air Pistol ESC Solo");
    expect(disciplineName("STR300", "sr")).toBe("300m standard puška");
    expect(disciplineName("R3JM", "sr")).toBe("50m puška 3x20");
  });

  it("adds gender only when asked and the discipline has one", () => {
    expect(disciplineName("ARM", "sr", { gender: true })).toBe("10m vazdušna puška – seniori");
    expect(disciplineName("ARW", "en", { gender: true })).toBe("10m Air Rifle Women");
    expect(disciplineName("STR300", "en", { gender: true })).toBe("300m Standard Rifle");
  });

  it("falls back to the code for unknown disciplines", () => {
    expect(disciplineName("XYZ", "sr")).toBe("XYZ");
  });
});
