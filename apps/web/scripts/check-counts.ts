import { db } from "@shootermarkt/db";
import { shooters, results, competitions } from "@shootermarkt/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Checking database row counts...");
  
  const shootersCount = await db.select({ count: sql<number>`count(*)` }).from(shooters);
  const resultsCount = await db.select({ count: sql<number>`count(*)` }).from(results);
  const compsCount = await db.select({ count: sql<number>`count(*)` }).from(competitions);

  console.log("Database state:");
  console.log(`- Shooters: ${shootersCount[0].count}`);
  console.log(`- Results: ${resultsCount[0].count}`);
  console.log(`- Competitions: ${compsCount[0].count}`);

  process.exit(0);
}

main().catch(console.error);
