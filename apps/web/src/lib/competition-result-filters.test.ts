import { describe, expect, it } from "vitest";
import { filterOptions, matchesFilters, type Facets } from "./competition-result-filters";
import { categoryLabel } from "./match-name";

const arm: Facets = { family: "rifle", categories: ["junior", "senior"], gender: "M" };
const apw: Facets = { family: "pistol", categories: ["kadet"], gender: "F" };
const mixed: Facets = { family: "pistol", categories: ["senior"], gender: "X" };
const open: Facets = { family: "rifle", categories: ["senior"], gender: null };

describe("filterOptions", () => {
  it("lists only present values, older categories first", () => {
    expect(filterOptions([apw, arm, mixed, open])).toEqual({
      family: ["rifle", "pistol"],
      category: ["senior", "junior", "kadet"],
      gender: ["M", "F", "X"],
    });
  });

  it("hides a filter that has a single value", () => {
    expect(filterOptions([open, { ...arm, categories: ["senior"] }])).toEqual({ family: [], category: [], gender: [] });
  });
});

describe("matchesFilters", () => {
  it("combines all filters", () => {
    expect(matchesFilters(arm, { family: "rifle", category: "junior", gender: "M" })).toBe(true);
    expect(matchesFilters(arm, { family: "rifle", category: "kadet" })).toBe(false);
    expect(matchesFilters(apw, {})).toBe(true);
  });

  it("shows open events for men and women, not for mixed", () => {
    expect(matchesFilters(open, { gender: "F" })).toBe(true);
    expect(matchesFilters(open, { gender: "X" })).toBe(false);
  });
});

describe("categoryLabel", () => {
  it("uses bare U18/U16 in English and full names in Serbian", () => {
    expect(categoryLabel("mladji_junior", "en")).toBe("U18");
    expect(categoryLabel("kadet", "en")).toBe("U16");
    expect(categoryLabel("kadet", "sr")).toBe("Kadet (U16)");
  });
});
