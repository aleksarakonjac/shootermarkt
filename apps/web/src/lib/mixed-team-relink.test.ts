// @vitest-environment node
// Upsert veza mešanog tima nad pravim Postgres-om. Preskače se bez TEST_DATABASE_URL; sme samo lokalna,
// prazna baza sa šemom (pg_trgm + `drizzle-kit export`) — nikad DATABASE_URL.
import { beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("mixed team re-import", () => {
  let commit: typeof import("./import-commit-mixed").commitMixedTeamEntries;
  let database: typeof import("@shootermarkt/db").db;
  let schema: typeof import("@shootermarkt/db/schema");
  let competitionId: number;
  let ids: number[];

  // [ime, prezime] — A i B su dva tima iste države
  const A = [["Mariam", "ABRAMISHVILI"], ["Kako", "MOSULISHVILI"]];
  const B = [["Mariami", "PRODIASHVILI"], ["Ioane", "KHVARESHIA"]];
  // nova država po pokretanju: strelci iz ranijih pokretanja ne učestvuju u poklapanju
  const noc = Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
  const team = (teamNumber: number, [m, f]: string[][]) => ({
    nocCode: noc, teamNumber, qualRank: teamNumber, qualTotal: 580 - teamNumber,
    m_firstName: m[0], m_lastName: m[1], f_firstName: f[0], f_lastName: f[1],
  });
  const importQual = async (...entries: ReturnType<typeof team>[]) => {
    const r = await commit({ discipline: "APMT", competitionId, isFinals: false, entries });
    expect(r.errors).toEqual([]);
  };
  const links = async () => (await database.select().from(schema.mixedTeamResults))
    .filter((r) => r.competitionId === competitionId)
    .sort((a, b) => a.teamNumber - b.teamNumber)
    .map((r) => [r.shooter1Id, r.shooter2Id]);

  beforeAll(async () => {
    if (!["127.0.0.1", "localhost"].includes(new URL(url!).hostname)) throw new Error("TEST_DATABASE_URL mora biti lokalna baza");
    process.env.DATABASE_URL = url;
    ({ db: database } = await import("@shootermarkt/db"));
    schema = await import("@shootermarkt/db/schema");
    ({ commitMixedTeamEntries: commit } = await import("./import-commit-mixed"));
    await database.insert(schema.disciplines).values({ code: "APMT", name: "10m Air Pistol Mixed Team" }).onConflictDoNothing();
    ids = (await database.insert(schema.shooters)
      .values([...A, ...B].map(([firstName, lastName]) => ({ firstName, lastName, nationality: noc })))
      .returning({ id: schema.shooters.id })).map((s) => s.id);
    [{ id: competitionId }] = await database.insert(schema.competitions)
      .values({ name: `relink ${Date.now()}`, date: "2026-10-18", level: "international" })
      .returning({ id: schema.competitions.id });
  });

  it("moves the links with the members when team numbers swap", async () => {
    const [a1, a2, b1, b2] = ids;
    await importQual(team(1, A), team(2, B));
    expect(await links()).toEqual([[a1, a2], [b1, b2]]);
    await importQual(team(1, B), team(2, A));
    expect(await links()).toEqual([[b1, b2], [a1, a2]]);
  });

  it("drops the old link when the new member has no profile", async () => {
    const [a1, a2] = ids;
    await importQual(team(1, [["Nepoznat", "NOVI"], ["Neznana", "NOVA"]]));
    expect(await links()).toEqual([[null, null], [a1, a2]]);
  });

  it("keeps an existing link while the name stays the same", async () => {
    const [a1, a2, b1] = ids;
    const { eq, and } = await import("drizzle-orm");
    const { mixedTeamResults: t } = schema;
    // ručno povezivanje na drugi profil, pa ponovni uvoz sa istim imenima (druga velika/mala slova)
    await database.update(t).set({ shooter1Id: b1 }).where(and(eq(t.competitionId, competitionId), eq(t.teamNumber, 2)));
    await importQual({ ...team(2, [["MARIAM", "Abramishvili"], A[1]]), qualTotal: 500 });
    expect((await links())[1]).toEqual([b1, a2]);
    expect(a1).not.toBe(b1);
  });

  it("live fetch: new link wins, an empty one keeps the old only for the same name", async () => {
    const [a1, , b1] = ids;
    const { eq, sql } = await import("drizzle-orm");
    const { teamLinkOnConflict } = await import("./mixed-team-link");
    const { mixedTeamResults: t } = schema;
    const [{ id: disciplineId }] = await database.select().from(schema.disciplines).where(eq(schema.disciplines.code, "APMT"));
    const live = async (shooter1Id: number | null, shooter1Name: string) => {
      const [row] = await database.insert(t)
        .values({ competitionId, disciplineId, nocCode: noc, teamNumber: 3, shooter1Id, shooter1Name })
        .onConflictDoUpdate({
          target: [t.competitionId, t.competitionEventId, t.disciplineId, t.category, t.nocCode, t.teamNumber],
          set: { shooter1Id: teamLinkOnConflict(1, "incoming"), shooter1Name: sql`excluded.shooter1_name` },
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
