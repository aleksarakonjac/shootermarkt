import { eq } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { countries } from "@shootermarkt/db/schema";

// Fills countries.name_en / name_sr from CLDR (Intl.DisplayNames) for rows with a 2-letter code.
// Existing values are kept unless --force is passed.
const force = process.argv.includes("--force");
const en = new Intl.DisplayNames("en", { type: "region" });
const sr = new Intl.DisplayNames("sr-Latn", { type: "region" });

// Historical NOCs share a modern country's code2 (for the flag), so CLDR would give the wrong name.
const HISTORIC_EN: Record<string, string> = {
  SCG: "Serbia and Montenegro", YUG: "Yugoslavia", TCH: "Czechoslovakia",
  URS: "Soviet Union", GDR: "East Germany", FRG: "West Germany",
};

async function main() {
  const rows = await db.select().from(countries);
  for (const c of rows) {
    const hist = HISTORIC_EN[c.code];
    if (hist) {
      await db.update(countries).set({ nameEn: hist, nameSr: c.name }).where(eq(countries.id, c.id));
      console.log(`${c.code}: ${hist} / ${c.name}`);
      continue;
    }
    if (!c.code2) { console.log(`skip ${c.code} (no code2)`); continue; }
    const nameEn = (force ? null : c.nameEn) ?? en.of(c.code2) ?? c.name;
    const nameSr = (force ? null : c.nameSr) ?? sr.of(c.code2) ?? c.name;
    await db.update(countries).set({ nameEn, nameSr }).where(eq(countries.id, c.id));
    console.log(`${c.code}: ${nameEn} / ${nameSr}`);
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
