import { afterEach, describe, expect, it, vi } from "vitest";
import { detectStage, fetchElimResultsFromHtml, fetchMixedTeamQualFromHtml, fetchQualResultsFromHtml, mapTitleToDisciplineCode, searchAthletes } from "./adapter";

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

describe("fetchQualResultsFromHtml", () => {
  it("reads rows with separate RPO and Q columns and spaced inner tens", async () => {
    const row = (rank: number, series: string[], total: string, rpo: string, q: string) =>
      `<tr><td align="right">${rank}</td><td align="right">12</td><td><a href="/athletes/SH${rank}">DOE&nbsp;Jane</a></td><td>GLP</td>${series.map((s) => `<td align="center">${s}</td>`).join("")}<td align="right">${total}</td><td>${rpo}</td><td>${q}</td><td class="resulttarget-cell"><a href="/x"><img src="/i.png" /></a></td></tr>`;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      row(1, ["98", "97", "95", "98", "98", "96"], "582 - 16x", "", "Q")
      + row(2, ["103.6", "105.7", "105.6", "103.3", "102.6", "104.6"], "625.4", "RPO", ""),
    )));

    await expect(fetchQualResultsFromHtml(1, "key")).resolves.toEqual([
      expect.objectContaining({ issfId: "SH1", total: 582, inners: 16, series: [98, 97, 95, 98, 98, 96], qualified: true, remark: null }),
      expect.objectContaining({ issfId: "SH2", total: 625.4, inners: null, series: [103.6, 105.7, 105.6, 103.3, 102.6, 104.6], qualified: false, remark: "RPO" }),
    ]);
  });
});

describe("multi-word surnames", () => {
  it.each([
    ["LOPEZ&nbsp;PAVON&nbsp;Mayssa", "LOPEZ PAVON", "Mayssa"],
    ["DE LA FUENTE&nbsp;Morena", "DE LA FUENTE", "Morena"],
    ["MARIE-LOUISE&nbsp;Nadiege Nicole", "MARIE-LOUISE", "Nadiege Nicole"],
  ])("splits %s", async (name, lastName, firstName) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      `<tr><td>1</td><td>12</td><td><a href="/athletes/SH1">${name}</a></td><td>PER</td><td>98</td><td>573-21x</td><td>Q</td></tr>`,
    )));

    await expect(fetchQualResultsFromHtml(1, "key")).resolves.toMatchObject([{ lastName, firstName }]);
  });
});

describe("fetchElimResultsFromHtml, 3 positions", () => {
  const athlete = (position: string, lead: string[], s1: string, s2: string, sum: string, total: string) =>
    `<tr>${[...lead, position, s1, s2, sum, total, "", ""].map((c) => `<td>${c}</td>`).join("")}</tr>`;
  const page = (s1: string, s2: string, sum: string, total: string) =>
    athlete("Kneeling", ["1", "1011", '<a href="/athletes/SH1">DOE&nbsp;Jane</a>', "ARG"], s1, s2, sum, "")
    + athlete("Prone", ["", "", "", ""], s1, s2, sum, "")
    + athlete("Standing", ["", "", "", ""], s1, s2, sum, total);

  it("reads the three-rows-per-athlete format", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(page("97", "96", "193", "579 - 25x"))));

    await expect(fetchElimResultsFromHtml(1, "key")).resolves.toMatchObject([
      { rank: 1, issfId: "SH1", nationCode: "ARG", total: 579, inners: 25, series: [97, 96, 97, 96, 97, 96] },
    ]);
  });

  it("ignores athletes who have no score yet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(page("", "", "", ""))));

    await expect(fetchElimResultsFromHtml(1, "key")).resolves.toEqual([]);
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

describe("mapTitleToDisciplineCode", () => {
  it.each([
    ["10m Air Rifle Men", "ARM"],
    ["Final 25m Rapid Fire Pistol Men", "RFPM"],
    ["25m Rapid Fire Pistol Men", "RFPM"],
    ["25m Standard Pistol Men", "STPM"],
    ["Final 25m Standard Pistol Women", "STPW"],
    ["50m Free Pistol Men", "FPM"],
    ["50m Pistol Men", "FPM"],
    ["50m Pistol Women", "FPW"],
    ["50m Free Pistol Women", "FPW"],
    ["50m Rifle Prone Women", "RPRW"],
    ["300m Rifle Three Positions Men", "R3P300M"],
    ["300m Rifle 3 Positions Women", "R3P300W"],
    ["300m Rifle Prone Men", "RPR300M"],
    ["300m Standard Rifle", "STR300"],
  ])("maps %s to %s", (title, code) => expect(mapTitleToDisciplineCode(title)).toBe(code));

  it("does not map a standard pistol event to the sport pistol", () => {
    expect(mapTitleToDisciplineCode("25m Standard Pistol Women")).not.toBe("SPW");
  });

  it("ignores events we do not track", () => {
    expect(mapTitleToDisciplineCode("Trap Men")).toBeNull();
    expect(mapTitleToDisciplineCode("25m Centre Fire Pistol Men Precision Stage")).toBeNull();
  });
});

describe("detectStage", () => {
  it.each([
    ["Pre-event Training 10m Air Rifle Men", "ARM", "training"],
    ["Unofficial Training 50m Pistol Men", "FPM", "training"],
    ["Medal Ceremony ARM", null, "ceremony"],
    ["Final 10m Air Rifle Men", "ARM", "final"],
    ["50m Rifle 3 Positions Men Elimination Relay 1", "R3PM", "elimination"],
    ["25m Pistol Women Rapid Fire Stage Relay 1 to 3", "SPW", "qual_rapid"],
    ["10m Air Rifle Men Relay 1", "ARM", "qual"],
  ] as const)("%s → %s", (title, code, stage) => expect(detectStage(title, code)).toBe(stage));
});
