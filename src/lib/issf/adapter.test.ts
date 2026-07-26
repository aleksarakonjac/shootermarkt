import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchElimResultsFromHtml, searchAthletes } from "./adapter";

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
