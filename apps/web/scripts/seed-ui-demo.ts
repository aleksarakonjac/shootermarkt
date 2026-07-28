import { eq } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { recomputeFormaCache } from "@/lib/forma-cache";
import { clubs, competitions, disciplines, results, shooters } from "@shootermarkt/db/schema";

const DEMO_SHOOTER_ISSF_ID = "DEMO-UI-SHOOTER-2026";
const DEMO_CLUB_NAME = "Demo Streljački Klub";

type DemoStart = {
  externalId: string;
  name: string;
  date: string;
  location: string;
  level: "regional" | "national" | "continental" | "world";
  category: "junior" | "mladji_senior" | "senior";
  score: number;
  rank: number;
  inners: number;
  final?: { total: number; rank: number };
};

const STARTS: DemoStart[] = [
  { externalId: "demo-ui-2026-01", name: "Demo kup Srbije - 1. kolo", date: "2026-01-17", location: "Beograd", level: "national", category: "junior", score: 624.6, rank: 6, inners: 0 },
  { externalId: "demo-ui-2026-02", name: "Demo juniorsko prvenstvo Srbije", date: "2026-02-14", location: "Novi Sad", level: "national", category: "junior", score: 628.3, rank: 3, inners: 0, final: { total: 230.6, rank: 3 } },
  { externalId: "demo-ui-2026-03", name: "Demo juniorski Svetski kup", date: "2026-03-08", location: "Suhl", level: "world", category: "junior", score: 627.1, rank: 11, inners: 0 },
  { externalId: "demo-ui-2026-04", name: "Demo regionalni kup Vojvodine", date: "2026-03-28", location: "Novi Sad", level: "regional", category: "mladji_senior", score: 629.4, rank: 2, inners: 0, final: { total: 232.1, rank: 2 } },
  { externalId: "demo-ui-2026-05", name: "Demo kup Srbije - 2. kolo", date: "2026-04-18", location: "Kragujevac", level: "national", category: "mladji_senior", score: 630.2, rank: 4, inners: 0 },
  { externalId: "demo-ui-2026-06", name: "Demo seniorsko prvenstvo Srbije", date: "2026-05-16", location: "Beograd", level: "national", category: "senior", score: 631.7, rank: 2, inners: 0, final: { total: 233.8, rank: 2 } },
  { externalId: "demo-ui-2026-07", name: "Demo Evropski kup", date: "2026-06-06", location: "Novi Sad", level: "continental", category: "senior", score: 630.8, rank: 7, inners: 0 },
  { externalId: "demo-ui-2026-08", name: "Demo kup Srbije - finale", date: "2026-06-27", location: "Beograd", level: "national", category: "senior", score: 632.4, rank: 1, inners: 0, final: { total: 235.4, rank: 1 } },
];

function seriesFor(total: number): number[] {
  const base = Math.floor((total / 6) * 10) / 10;
  const firstFive = [base - 0.4, base + 0.3, base - 0.1, base + 0.2, base - 0.2];
  const last = Number((total - firstFive.reduce((sum, score) => sum + score, 0)).toFixed(1));
  return [...firstFive, last];
}

async function seedUiDemo() {
  const [club] = await db
    .insert(clubs)
    .values({ name: DEMO_CLUB_NAME, shortName: "Demo SK", city: "Beograd", nocCode: "SRB" })
    .onConflictDoNothing()
    .returning();
  const clubId = club?.id ?? (await db.query.clubs.findFirst({ where: eq(clubs.name, DEMO_CLUB_NAME) }))?.id;
  if (!clubId) throw new Error("Demo klub nije moguće pronaći.");

  const [shooter] = await db
    .insert(shooters)
    .values({
      firstName: "Milan",
      lastName: "Jovanović",
      birthYear: 2005,
      gender: "M",
      apparatus: "air_rifle",
      nationality: "SRB",
      clubId,
      issfId: DEMO_SHOOTER_ISSF_ID,
      verified: true,
    })
    .onConflictDoUpdate({
      target: shooters.issfId,
      set: { clubId, verified: true, apparatus: "air_rifle" },
    })
    .returning();
  const shooterId = shooter.id;

  const arm = await db.query.disciplines.findFirst({ where: eq(disciplines.code, "ARM") });
  if (!arm) throw new Error("Disciplina ARM ne postoji. Prvo pokreni pnpm db:seed.");

  await db.delete(results).where(eq(results.shooterId, shooterId));

  for (const start of STARTS) {
    const values = {
      name: start.name,
      date: start.date,
      location: start.location,
      level: start.level,
      ageCategory: start.category,
      organizer: "DEMO",
      externalId: start.externalId,
    } as const;
    const existingCompetition = await db.query.competitions.findFirst({
      where: eq(competitions.externalId, start.externalId),
    });
    const [competition] = existingCompetition
      ? await db
          .update(competitions)
          .set({
            name: start.name,
            date: start.date,
            location: start.location,
            level: start.level,
            ageCategory: start.category,
          })
          .where(eq(competitions.id, existingCompetition.id))
          .returning()
      : await db.insert(competitions).values(values).returning();

    await db.insert(results).values({
      shooterId,
      competitionId: competition.id,
      disciplineId: arm.id,
      clubId,
      category: start.category,
      qualTotal: String(start.score),
      qualInners: start.inners,
      qualRank: start.rank,
      qualDetail: { series: seriesFor(start.score) },
      qualified: Boolean(start.final),
      finalTotal: start.final ? String(start.final.total) : null,
      finalRank: start.final?.rank ?? null,
      source: "manual",
    });
  }

  await recomputeFormaCache([shooterId]);
  console.log(`Demo UI shooter seeded: /sr/srb/strelci/${shooterId}`);
}

seedUiDemo().catch((error) => {
  console.error(error);
  process.exit(1);
});
