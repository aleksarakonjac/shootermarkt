import { db } from "../src/lib/db";
import { results } from "../src/lib/db/schema";

async function main() {
  console.log("Brisanje svih rezultata iz tabele 'results'...");
  try {
    const res = await db.delete(results).returning({ id: results.id });
    console.log(`Uspešno obrisano ${res.length} rezultata!`);
  } catch (error) {
    console.error("Greška pri brisanju rezultata:", error);
  }
  process.exit(0);
}

main().catch(console.error);
