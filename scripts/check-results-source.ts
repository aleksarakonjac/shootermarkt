import { db } from "../src/lib/db";
import { shooters, results, competitions } from "../src/lib/db/schema";
import { eq, or, ilike, and } from "drizzle-orm";

async function main() {
  console.log("Checking results for Vasilije Gilić, Boris Marinković, and Dejan Ćeranić...");

  const targetShooters = await db
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
    })
    .from(shooters)
    .where(
      or(
        and(ilike(shooters.firstName, "%Vasilije%"), ilike(shooters.lastName, "%Gilic%")),
        and(ilike(shooters.firstName, "%Boris%"), ilike(shooters.lastName, "%Marinkovic%")),
        and(ilike(shooters.firstName, "%Dejan%"), ilike(shooters.lastName, "%Ceranic%"))
      )
    );

  console.log("Found shooters:", targetShooters);

  if (targetShooters.length === 0) {
    console.log("No shooters found matching these names.");
    process.exit(0);
  }

  for (const s of targetShooters) {
    const sResults = await db
      .select({
        id: results.id,
        qualTotal: results.qualTotal,
        source: results.source,
        competitionName: competitions.name,
        competitionDate: competitions.date,
      })
      .from(results)
      .innerJoin(competitions, eq(results.competitionId, competitions.id))
      .where(eq(results.shooterId, s.id));

    console.log(`\nResults for ${s.firstName} ${s.lastName} (ID: ${s.id}):`);
    if (sResults.length === 0) {
      console.log("  No results found in the database.");
    } else {
      for (const r of sResults) {
        console.log(`  - Score: ${r.qualTotal}, Source: ${r.source}, Comp: "${r.competitionName}" (${r.competitionDate})`);
      }
    }
  }

  process.exit(0);
}

main().catch(console.error);
