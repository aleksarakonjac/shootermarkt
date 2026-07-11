/**
 * Demo seed — inserts one shooter with realistic result history.
 * Run: pnpm db:seed-demo
 */
import { db } from "./index";
import { clubs, shooters, competitions, disciplines, results } from "./schema";
import { eq } from "drizzle-orm";

async function seedDemo() {
  console.log("Seeding demo shooter...");

  // ── Club ────────────────────────────────────────────────────────────────────
  const [club] = await db
    .insert(clubs)
    .values({ name: "SK Pančevo 1813", shortName: "SK Pančevo", city: "Pančevo", nocCode: "SRB" })
    .onConflictDoNothing()
    .returning();

  let clubId = club?.id;
  if (!clubId) {
    const existing = await db.query.clubs.findFirst({ where: eq(clubs.name, "SK Pančevo 1813") });
    clubId = existing!.id;
  }

  // ── Shooter ─────────────────────────────────────────────────────────────────
  const [shooter] = await db
    .insert(shooters)
    .values({
      firstName: "Aleksa",
      lastName: "Rakonjac",
      birthYear: 2003,
      gender: "M",
      apparatus: "rifle",
      nationality: "SRB",
      clubId,
      verified: true,
    })
    .onConflictDoNothing()
    .returning();

  let shooterId = shooter?.id;
  if (!shooterId) {
    const existing = await db.query.shooters.findFirst({
      where: eq(shooters.lastName, "Rakonjac"),
    });
    shooterId = existing!.id;
    await db.delete(results).where(eq(results.shooterId, shooterId));
    console.log(`Shooter already exists (id=${shooterId}), cleared results, reseeding...`);
  }

  console.log(`Created shooter id=${shooterId}`);

  // ── Discipline IDs ──────────────────────────────────────────────────────────
  const discRows = await db.select().from(disciplines);
  const byCode = Object.fromEntries(discRows.map((d) => [d.code, d.id]));
  const armId = byCode["ARM"];
  const apmId = byCode["APM"];

  if (!armId || !apmId) {
    console.error("Disciplines not found — run pnpm db:seed first.");
    process.exit(1);
  }

  // ── Competitions + Results ───────────────────────────────────────────────────
  type CompetitionLevel = "club" | "regional" | "national" | "international" | "continental" | "world" | "olympic";

  const comps: {
    name: string;
    date: string;
    location: string;
    level: CompetitionLevel;
    armScore: number;
    armRank: number;
    armFinal?: number;
    armFinalRank?: number;
  }[] = [
    { name: "Kup Srbije — 1. kolo",               date: "2022-02-19", location: "Beograd",    level: "national",    armScore: 629.2, armRank: 5 },
    { name: "Regionalni kup Vojvodine",             date: "2022-04-02", location: "Novi Sad",   level: "regional",    armScore: 628.1, armRank: 3 },
    { name: "Državno juniorsko prvenstvo Srbije",  date: "2022-05-14", location: "Beograd",    level: "national",    armScore: 630.4, armRank: 4 },
    { name: "Kup Srbije — 2. kolo",               date: "2022-06-25", location: "Niš",         level: "national",    armScore: 631.7, armRank: 3, armFinal: 229.6, armFinalRank: 3 },
    { name: "Juniorski Svetski kup — Suhl",        date: "2022-08-13", location: "Suhl, DE",   level: "world",       armScore: 628.6, armRank: 14 },
    { name: "Balkansko juniorsko prvenstvo",        date: "2022-09-24", location: "Sofija, BG", level: "continental", armScore: 629.8, armRank: 6 },
    { name: "Državno seniorsko prvenstvo Srbije",  date: "2022-11-05", location: "Beograd",    level: "national",    armScore: 630.0, armRank: 4, armFinal: 230.1, armFinalRank: 4 },
    { name: "Kup Srbije — 1. kolo",               date: "2023-02-11", location: "Kragujevac", level: "national",    armScore: 632.3, armRank: 2, armFinal: 231.8, armFinalRank: 2 },
    { name: "Regionalni kup Vojvodine",             date: "2023-03-25", location: "Novi Sad",   level: "regional",    armScore: 629.5, armRank: 2 },
    { name: "Državno juniorsko prvenstvo Srbije",  date: "2023-05-06", location: "Beograd",    level: "national",    armScore: 631.0, armRank: 3, armFinal: 230.5, armFinalRank: 3 },
    { name: "Juniorski Svetski kup — Baku",        date: "2023-06-17", location: "Baku, AZ",   level: "world",       armScore: 628.4, armRank: 11 },
    { name: "Kup Srbije — 2. kolo",               date: "2023-08-05", location: "Beograd",    level: "national",    armScore: 630.9, armRank: 3, armFinal: 232.4, armFinalRank: 3 },
    { name: "Juniorsko Evropsko prvenstvo",         date: "2023-09-16", location: "Osijek, HR", level: "continental", armScore: 629.1, armRank: 8 },
    { name: "Državno seniorsko prvenstvo Srbije",  date: "2023-11-04", location: "Beograd",    level: "national",    armScore: 632.8, armRank: 2, armFinal: 233.2, armFinalRank: 2 },
    { name: "Kup Srbije — 1. kolo",               date: "2024-02-10", location: "Novi Sad",   level: "national",    armScore: 630.2, armRank: 4 },
    { name: "Regionalni kup Vojvodine",             date: "2024-03-23", location: "Novi Sad",   level: "regional",    armScore: 631.5, armRank: 1, armFinal: 231.0, armFinalRank: 1 },
    { name: "Državno juniorsko prvenstvo Srbije",  date: "2024-05-04", location: "Beograd",    level: "national",    armScore: 628.7, armRank: 5 },
    { name: "Juniorski Svetski kup — München",     date: "2024-06-15", location: "München, DE",level: "world",       armScore: 630.6, armRank: 9 },
    { name: "Kup Srbije — 2. kolo",               date: "2024-08-03", location: "Niš",         level: "national",    armScore: 632.1, armRank: 2, armFinal: 233.8, armFinalRank: 2 },
    { name: "Balkansko seniorsko prvenstvo",        date: "2024-09-14", location: "Beograd",    level: "continental", armScore: 631.3, armRank: 3, armFinal: 230.7, armFinalRank: 3 },
    { name: "Državno seniorsko prvenstvo Srbije",  date: "2024-10-26", location: "Beograd",    level: "national",    armScore: 633.0, armRank: 1, armFinal: 235.4, armFinalRank: 1 },
    { name: "Kup Srbije — 1. kolo",               date: "2025-02-08", location: "Beograd",    level: "national",    armScore: 629.4, armRank: 4 },
    { name: "Regionalni kup Vojvodine",             date: "2025-03-22", location: "Novi Sad",   level: "regional",    armScore: 630.8, armRank: 2, armFinal: 231.3, armFinalRank: 2 },
    { name: "Državno juniorsko seniorsko SP",      date: "2025-04-12", location: "Kragujevac", level: "national",    armScore: 628.9, armRank: 5 },
    { name: "Juniorski Svetski kup — Bjelov",      date: "2025-05-24", location: "Bjelov, HU", level: "world",       armScore: 631.8, armRank: 7 },
    { name: "Kup Srbije — 2. kolo",               date: "2025-06-14", location: "Beograd",    level: "national",    armScore: 632.5, armRank: 2, armFinal: 234.1, armFinalRank: 2 },
    { name: "Juniorsko Svetsko prvenstvo",          date: "2025-07-05", location: "Kairo, EG",  level: "world",       armScore: 630.3, armRank: 6 },
    { name: "Balkansko juniorsko seniorsko SP",    date: "2025-08-02", location: "Sofija, BG", level: "continental", armScore: 631.1, armRank: 3, armFinal: 232.9, armFinalRank: 3 },
    { name: "Kup Srbije — finale",                 date: "2025-09-13", location: "Beograd",    level: "national",    armScore: 632.9, armRank: 1, armFinal: 236.0, armFinalRank: 1 },
    { name: "Državno seniorsko prvenstvo Srbije",  date: "2025-10-25", location: "Beograd",    level: "national",    armScore: 633.0, armRank: 1, armFinal: 235.7, armFinalRank: 1 },
  ];

  for (const c of comps) {
    const [comp] = await db
      .insert(competitions)
      .values({
        name: c.name,
        date: c.date,
        location: c.location,
        level: c.level,
      })
      .returning();

    // ARM result
    await db.insert(results).values({
      shooterId,
      competitionId: comp.id,
      disciplineId: armId,
      qualTotal: String(c.armScore),
      qualRank: c.armRank,
      finalTotal: c.armFinal != null ? String(c.armFinal) : null,
      finalRank: c.armFinalRank ?? null,
      source: "manual",
    });



    console.log(`  ✓ ${c.name} (${c.date})`);
  }

  console.log(`\nDemo seed complete. Shooter profile: /strelci/${shooterId}`);
  process.exit(0);
}

seedDemo().catch((e) => {
  console.error(e);
  process.exit(1);
});
