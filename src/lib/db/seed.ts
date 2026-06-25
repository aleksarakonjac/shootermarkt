import { db } from "./index";
import { disciplines, clubs } from "./schema";

async function seed() {
  console.log("Seeding disciplines...");
  await db
    .insert(disciplines)
    .values([
      {
        code: "ARM",
        name: "10m Air Rifle Men",
        maxQualScore: "632.0",
        hasDecimals: true,
        seriesCount: 6,
      },
      {
        code: "ARW",
        name: "10m Air Rifle Women",
        maxQualScore: "632.0",
        hasDecimals: true,
        seriesCount: 6,
      },
      {
        code: "APM",
        name: "10m Air Pistol Men",
        maxQualScore: "600",
        hasDecimals: false,
        seriesCount: 6,
      },
      {
        code: "APW",
        name: "10m Air Pistol Women",
        maxQualScore: "600",
        hasDecimals: false,
        seriesCount: 6,
      },
    ])
    .onConflictDoNothing();

  console.log("Seeding clubs...");
  await db
    .insert(clubs)
    .values([
      { name: "SK Pančevo 1813", city: "Pančevo", nocCode: "PAN" },
      { name: "SK Beograd", city: "Beograd", nocCode: "BEO" },
      { name: "SK Novi Sad", city: "Novi Sad", nocCode: "NS" },
      { name: "SK Kragujevac", city: "Kragujevac", nocCode: "KRG" },
    ])
    .onConflictDoNothing();

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
