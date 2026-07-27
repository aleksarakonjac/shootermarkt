import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchElimResultsFromHtml, fetchMixedTeamQualFromHtml, searchAthletes } from "./adapter";

afterEach(() => vi.unstubAllGlobals());

describe("searchAthletes", () => {
  it("limits capped-name pagination to eight concurrent ISSF requests", async () => {
    let active = 0;
    let peak = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active -= 1;
      const capped = url.endsWith("search=SRB");
      return new Response(JSON.stringify(capped ? Array.from({ length: 300 }, (_, i) => ({ issfId: String(i) })) : []));
    }));

    await searchAthletes("SRB");

    expect(peak).toBe(8);
  });
});

describe("fetchElimResultsFromHtml", () => {
  it("keeps inner tens from an elimination total", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`
      <tr><td>1</td><td>12</td><td><a href="/athletes/athlete-1">DOE Jane</a></td><td>SRB</td><td>98</td><td>97</td><td>96</td><td>95</td><td>94</td><td>93</td><td>573-21x</td><td>Q</td></tr>
    `)));

    await expect(fetchElimResultsFromHtml(1, "R3PW")).resolves.toMatchObject([
      { total: 573, inners: 21 },
    ]);
  });
});

describe("fetchMixedTeamQualFromHtml", () => {
  it("keeps each APMT shooter's inner tens", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`
      <tr><td>1</td><td>12</td><td>SRB</td><td>570-18x</td><td>Q</td></tr>
      <tr><td></td><td>12</td><td><a href="/athletes/SHSRBM123">DOE John</a></td><td></td><td>96</td><td>95</td><td>96</td><td>287-10x</td></tr>
      <tr><td></td><td>12</td><td><a href="/athletes/SHSRBW456">DOE Jane</a></td><td></td><td>94</td><td>95</td><td>94</td><td>283-8x</td></tr>
    `)));

    await expect(fetchMixedTeamQualFromHtml(1, "APMT")).resolves.toMatchObject([
      { mInners: 10, mTotal: 287, fInners: 8, fTotal: 283 },
    ]);
  });
});
