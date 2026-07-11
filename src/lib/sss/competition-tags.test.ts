import { describe, expect, it } from "vitest";
import { getSssCompetitionTags } from "./competition-tags";

describe("getSssCompetitionTags", () => {
  it("tags MK competitions", () => {
    expect(getSssCompetitionTags("MK puška 50m")).toEqual(["MK", "50m"]);
  });

  it("tags 25m and 50m combinations as 50/25m", () => {
    expect(getSssCompetitionTags("Prvenstvo Srbije 25m i 50m")).toEqual(["50/25m"]);
  });

  it("tags a 10m-only competition", () => {
    expect(getSssCompetitionTags("A program 10m")).toEqual(["10m"]);
  });
});
