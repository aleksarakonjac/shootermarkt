// @vitest-environment node
// Ponovni upis mešanih timova nad pravim Postgres-om. Preskače se bez TEST_DATABASE_URL; sme samo lokalna
// baza za testiranje sa šemom (pg_trgm + `drizzle-kit export`) — nikad DATABASE_URL.
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { MixedTeamEntry } from "@shootermarkt/db/pdf-import-types";
import type { SiusMixedTeamData, SiusTeamResult } from "@shootermarkt/adapters/sius/public-adapter";

const url = process.env.TEST_DATABASE_URL;
const sius = vi.hoisted(() => ({ mixed: new Map<string, unknown>() }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@shootermarkt/adapters/sius/public-adapter", async (original) => ({
  ...(await original<typeof import("@shootermarkt/adapters/sius/public-adapter")>()),
  fetchLiveSiusResults: async () => new Map(),
  fetchLiveSiusMixedTeamResults: async () => sius.mixed,
}));

describe.skipIf(!url)("mixed team re-import", () => {
  let lib: typeof import("./import-commit-mixed");
  let database: typeof import("@shootermarkt/db").db;
  let schema: typeof import("@shootermarkt/db/schema");
  let orm: typeof import("drizzle-orm");
  let disciplineId: number;

  // [ime, prezime] — A i B su dva tima iste države
  const A = [["Mariam", "ABRAMISHVILI"], ["Kako", "MOSULISHVILI"]];
  const B = [["Mariami", "PRODIASHVILI"], ["Ioane", "KHVARESHIA"]];

  /** Svaki test ima svoje takmičenje, državu i strelce, pa ne vidi ranija pokretanja. */
  async function setup(extra: { siusId?: string } = {}) {
    let noc: string, used: unknown[];
    do {
      noc = Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
      used = await database.select().from(schema.shooters).where(orm.eq(schema.shooters.nationality, noc)).limit(1);
    } while (used.length);
    const ids = (await database.insert(schema.shooters)
      .values([...A, ...B].map(([firstName, lastName]) => ({ firstName, lastName, nationality: noc })))
      .returning({ id: schema.shooters.id })).map((s) => s.id);
    const [{ id: competitionId }] = await database.insert(schema.competitions)
      .values({ name: `relink ${noc} ${Date.now()}`, date: "2026-10-18", level: "international", ...extra })
      .returning({ id: schema.competitions.id });
    const team = (teamNumber: number, [m, f]: string[][], over: Partial<MixedTeamEntry> = {}): MixedTeamEntry => ({
      skip: false, nocCode: noc, teamNumber, disciplineCode: "APMT", qualRank: teamNumber, qualTotal: 580 - teamNumber, inners: null,
      qualified: false, finalRank: null, finalTotal: null,
      mIssfId: null, mFirstName: m[0], mLastName: m[1], m_series: [], mInners: null, mTotal: 290,
      fIssfId: null, fFirstName: f[0], fLastName: f[1], f_series: [], fInners: null, fTotal: 289, ...over,
    });
    const importTeams = async (...entries: MixedTeamEntry[]) => {
      const r = await lib.commitMixedTeamsDirect(competitionId, entries);
      expect(r.errors).toEqual([]);
      return r;
    };
    const rows = async () => (await database.select().from(schema.mixedTeamResults)
      .where(orm.eq(schema.mixedTeamResults.competitionId, competitionId)))
      .sort((a, b) => a.teamNumber - b.teamNumber);
    /** [prvi član, veze, kval. zbir, finalni zbir] po broju tima */
    const state = async () => (await rows()).map((r) => [r.shooter1Name?.split(" ")[0], [r.shooter1Id, r.shooter2Id], r.qualTotal, r.finalTotal]);
    return { noc, ids, competitionId, team, importTeams, rows, state };
  }

  beforeAll(async () => {
    if (!["127.0.0.1", "localhost"].includes(new URL(url!).hostname)) throw new Error("TEST_DATABASE_URL mora biti lokalna baza");
    process.env.DATABASE_URL = url;
    process.env.CRON_SECRET = "test";
    ({ db: database } = await import("@shootermarkt/db"));
    schema = await import("@shootermarkt/db/schema");
    orm = await import("drizzle-orm");
    lib = await import("./import-commit-mixed");
    await database.insert(schema.disciplines).values({ code: "APMT", name: "10m Air Pistol Mixed Team" }).onConflictDoNothing();
    [{ id: disciplineId }] = await database.select().from(schema.disciplines).where(orm.eq(schema.disciplines.code, "APMT"));
  });

  it("keeps each pair on its row, with its final and links, when team numbers swap", async () => {
    const { ids: [a1, a2, b1, b2], team, importTeams, state } = await setup();
    await importTeams(team(1, A, { finalRank: 1, finalTotal: 480 }), team(2, B));
    await importTeams(team(1, B, { qualTotal: 585 }), team(2, A, { qualTotal: 570, finalRank: 1, finalTotal: 481 }));
    expect(await state()).toEqual([
      ["ABRAMISHVILI", [a1, a2], "570.0", "481.0"],
      ["PRODIASHVILI", [b1, b2], "585.0", null],
    ]);
  });

  it("writes a final onto the pair that shot it", async () => {
    const { ids: [a1, a2, b1, b2], team, importTeams, state } = await setup();
    await importTeams(team(1, A), team(2, B));
    await importTeams(team(1, B, { finalRank: 1, finalTotal: 480 }), team(2, A));
    expect(await state()).toEqual([
      ["ABRAMISHVILI", [a1, a2], "578.0", null],
      ["PRODIASHVILI", [b1, b2], "579.0", "480.0"],
    ]);
  });

  it("keeps the row on a one-member change and takes the new link, even an empty one", async () => {
    const { ids: [a1, , b1, b2], team, importTeams, state } = await setup();
    await importTeams(team(1, A), team(2, B));
    await importTeams(team(1, [A[0], ["Nepoznat", "NOVI"]]), team(2, B));
    expect((await state()).map((r) => r[1])).toEqual([[a1, null], [b1, b2]]);
  });

  it("gives an unknown pair a new row instead of overwriting another one", async () => {
    const { ids: [a1, a2], team, importTeams, state } = await setup();
    await importTeams(team(1, A));
    await importTeams(team(1, [["Nepoznat", "NOVI"], ["Neznana", "NOVA"]]));
    expect(await state()).toEqual([
      ["ABRAMISHVILI", [a1, a2], "579.0", null],
      ["NOVI", [null, null], "579.0", null],
    ]);
  });

  it("keeps an existing link while the name stays the same", async () => {
    const { ids: [, a2, b1], competitionId, team, importTeams, rows } = await setup();
    await importTeams(team(1, A));
    const { mixedTeamResults: t } = schema;
    // ručno povezivanje na drugi profil, pa ponovni uvoz sa istim imenima (druga velika/mala slova)
    await database.update(t).set({ shooter1Id: b1 }).where(orm.eq(t.competitionId, competitionId));
    await importTeams(team(1, [["MARIAM", "Abramishvili"], A[1]], { qualTotal: 500 }));
    const [row] = await rows();
    expect([row.shooter1Id, row.shooter2Id, row.qualTotal]).toEqual([b1, a2, "500.0"]);
  });

  it("replaces a namesake link once the ISSF id points to another profile", async () => {
    const { noc, team, importTeams, rows } = await setup();
    const pair = [["Yejin", "KIM"], ["Jun", "PARK"]];
    const add = async (issfId: string | null) => (await database.insert(schema.shooters)
      .values({ firstName: "Yejin", lastName: "KIM", nationality: noc, issfId }).returning({ id: schema.shooters.id }))[0].id;
    const links = async () => (await rows()).map((r) => [r.shooter1Id, r.shooter2Id]);
    const namesake = await add(null);
    await importTeams(team(1, pair));
    expect(await links()).toEqual([[namesake, null]]);
    // isti rezultati, ali SIUS sada daje ID drugog profila
    const issfId = `SHKORW${Date.now()}`;
    const correct = await add(issfId);
    await importTeams(team(1, pair, { mIssfId: issfId }));
    expect(await links()).toEqual([[correct, null]]);
  });

  it("previews the same re-import in another order as unchanged", async () => {
    const { competitionId, team, importTeams } = await setup();
    await importTeams(team(1, A), team(2, B));
    const swapped = [team(1, B, { qualRank: 2, qualTotal: 578 }), team(2, A, { qualRank: 1, qualTotal: 579 })];
    expect((await lib.previewMixedTeams(competitionId, swapped)).map((r) => r.status)).toEqual(["same", "same"]);
  });

  it("live fetch: a final-only run writes each pair's final onto its qualification row", async () => {
    const { noc, ids: [a1, a2, b1, b2], competitionId, state } = await setup({ siusId: `relink-${Date.now()}` });
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/cron/live-fetch/route");
    const athlete = ([firstName, lastName]: string[]) => ({ siusAthleteId: null, firstName, lastName, nation: noc, total: 290, inners: null, series: [] });
    const result = (rank: number, pair: string[][], total: number): SiusTeamResult => ({
      rank, nocCode: noc, total, inners: null, qualified: true, remark: null, statusRemark: null,
      penalty: null, shootOff: null, record: null, athletes: pair.map(athlete),
    });
    const slot = { competitionId, disciplineId, category: "senior" as const, startTime: new Date(Date.now() - 60_000) };
    const run = async (stage: string, data: SiusMixedTeamData) => {
      await database.delete(schema.competitionSchedule);
      await database.insert(schema.competitionSchedule).values({ ...slot, stage });
      sius.mixed = new Map([["APMT", data]]);
      const response = await GET(new NextRequest("http://localhost/api/cron/live-fetch?secret=test"));
      expect(response.status).toBe(200);
    };

    await run("qual", { qual: [result(1, A, 580), result(2, B, 578)], final: [] });
    // u finalu je poredak obrnut
    await run("final", { qual: [], final: [result(1, B, 480), result(2, A, 470)] });

    expect(await state()).toEqual([
      ["ABRAMISHVILI", [a1, a2], "580.0", "470.0"],
      ["PRODIASHVILI", [b1, b2], "578.0", "480.0"],
    ]);
  });

  it("PDF import with createMissing creates each new shooter once and keeps pairs on their rows", async () => {
    const { team, importTeams, rows } = await setup();
    const P = [["Prva", "PDFNOVA"], ["Drugi", "PDFNOVI"]];
    const Q = [["Treca", "PDFTRECA"], ["Cetvrti", "PDFCETVRTI"]];
    const created = (teamNumber: number, pair: string[][]) => team(teamNumber, pair, { createMissing: true });
    const links = async () => (await rows()).map((r) => [r.shooter1Id, r.shooter2Id]);
    const shooters = async () => (await database.select().from(schema.shooters)).length;
    await importTeams(created(1, P), created(2, Q));
    const first = await links();
    expect(first.flat().every(Boolean)).toBe(true);
    const before = await shooters();
    await importTeams(created(1, Q), created(2, P));
    expect(await links()).toEqual(first);
    expect(await shooters()).toBe(before);
  });

  it("PDF import with createMissing gives a replaced member an own profile, not the stored one", async () => {
    const { ids: [a1, a2], team, importTeams, rows } = await setup();
    await importTeams(team(1, A));
    await importTeams(team(1, [A[0], ["Zamena", "PDFZAMENA"]], { createMissing: true }));
    const [row] = await rows();
    expect(row.shooter1Id).toBe(a1);
    expect(row.shooter2Id).not.toBeNull();
    expect(row.shooter2Id).not.toBe(a2);
  });

  it("live fetch upsert: a new link wins, an empty one keeps the old only for the same name", async () => {
    const { noc, ids: [a1, , b1], competitionId } = await setup();
    const { teamLinkOnConflict } = await import("./mixed-team-link");
    const { mixedTeamResults: t } = schema;
    const live = async (shooter1Id: number | null, shooter1Name: string) => {
      const [row] = await database.insert(t)
        .values({ competitionId, disciplineId, nocCode: noc, teamNumber: 1, shooter1Id, shooter1Name })
        .onConflictDoUpdate({
          target: [t.competitionId, t.competitionEventId, t.disciplineId, t.category, t.nocCode, t.teamNumber],
          set: { shooter1Id: teamLinkOnConflict(1, "incoming"), shooter1Name: orm.sql`excluded.shooter1_name` },
        })
        .returning({ shooter1Id: t.shooter1Id });
      return row.shooter1Id;
    };
    expect(await live(a1, "ABRAMISHVILI Mariam")).toBe(a1);
    expect(await live(null, "ABRAMISHVILI Mariam")).toBe(a1);
    expect(await live(b1, "ABRAMISHVILI Mariam")).toBe(b1);
    expect(await live(null, "NOVI Nepoznat")).toBeNull();
  });
});
