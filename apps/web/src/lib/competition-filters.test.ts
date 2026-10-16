import { describe, expect, it } from "vitest";
import {
  groupsFromDistances, groupsFromName, levelsForGroups, mergeGroups, parseDisciplineParam, parseLevelParam,
} from "./competition-filters";

describe("competition filters", () => {
  it("maps discipline distances to groups", () => {
    expect(groupsFromDistances([10, 10])).toEqual(["air"]);
    expect(groupsFromDistances([50, 25])).toEqual(["smallbore"]);
    expect(groupsFromDistances([10, 50, null])).toEqual(["air", "smallbore"]);
    expect(groupsFromDistances([])).toEqual([]);
  });

  it("derives groups from names without treating round or edition numbers as distances", () => {
    expect(groupsFromName("A program 10m")).toEqual(["air"]);
    expect(groupsFromName("Prvenstvo Srbije 25m i 50m")).toEqual(["smallbore"]);
    expect(groupsFromName("MK puška 50m")).toEqual(["smallbore"]);
    expect(groupsFromName("Vazdušno oružje i MK")).toEqual(["air", "smallbore"]);
    expect(groupsFromName("Liga Srbije, 10. kolo")).toEqual([]);
    expect(groupsFromName("25. memorijal Petar Petrović")).toEqual([]);
  });

  it("parses level params, including legacy single levels", () => {
    expect(parseLevelParam("national,continental")).toEqual(["national", "continental"]);
    expect(parseLevelParam("olympic,world")).toEqual(["world"]);
    expect(parseLevelParam("club")).toEqual(["regional"]);
    expect(parseLevelParam("nonsense")).toEqual([]);
    expect(levelsForGroups(["world", "regional"])).toEqual(["olympic", "world", "regional", "club"]);
  });

  it("parses discipline params and legacy tag links", () => {
    expect(parseDisciplineParam("air,smallbore")).toEqual(["air", "smallbore"]);
    expect(parseDisciplineParam(undefined, "MK")).toEqual(["smallbore"]);
    expect(parseDisciplineParam("air", "10m")).toEqual(["air"]);
    expect(parseDisciplineParam("x")).toEqual([]);
  });

  it("merges groups in a stable order", () => {
    expect(mergeGroups(["smallbore"], ["air"])).toEqual(["air", "smallbore"]);
  });
});
