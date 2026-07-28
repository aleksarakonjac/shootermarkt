import { db } from "@shootermarkt/db";
import { shooters } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  // Provjeri da li kolona postoji
  try {
    const row = await db.select({ id: shooters.id, avatarUrl: shooters.avatarUrl }).from(shooters).limit(1);
    console.log("SELECT avatarUrl OK:", row);
  } catch(e) { console.error("SELECT failed:", e); }

  // Test update
  try {
    const res = await db.update(shooters).set({ avatarUrl: "https://test.com/test.webp" }).where(eq(shooters.id, 1)).returning({ id: shooters.id, avatarUrl: shooters.avatarUrl });
    console.log("UPDATE OK:", res);
    // Vrati na null
    await db.update(shooters).set({ avatarUrl: null }).where(eq(shooters.id, 1));
    console.log("RESET OK");
  } catch(e) { console.error("UPDATE failed:", (e as Error).message, "\n", e); }
}

main();
