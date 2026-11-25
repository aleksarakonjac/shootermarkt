import { writeFileSync } from "node:fs";
import { and, inArray, isNotNull, notLike } from "drizzle-orm";
import { db } from "@shootermarkt/db";
import { shooters } from "@shootermarkt/db/schema";

// Briše iz shooters.issf_id vrednosti koje nisu ISSF ID (SIUS "S35/21945", "ESC…"), a koje je ranije upisao SIUS uvoz.
// issf_synced_at se resetuje da ISSF auto-link po imenu ponovo pokuša.
// Dry-run je podrazumevan: `pnpm db:clear-non-issf-ids` ispiše, `pnpm db:clear-non-issf-ids --apply` upisuje.
const apply = process.argv.includes("--apply");

async function main() {
  const bad = await db
    .select({
      id: shooters.id, lastName: shooters.lastName, firstName: shooters.firstName,
      nationality: shooters.nationality, issfId: shooters.issfId, issfSyncedAt: shooters.issfSyncedAt,
    })
    .from(shooters)
    .where(and(isNotNull(shooters.issfId), notLike(shooters.issfId, "SH%")))
    .orderBy(shooters.id);

  console.log(`${apply ? "APPLY" : "DRY-RUN"} — ${bad.length} strelaca sa issf_id koji ne počinje sa "SH"`);
  for (const s of bad) console.log(`${s.id}\t${s.nationality ?? ""}\t${s.lastName} ${s.firstName}\t${s.issfId}`);

  if (!apply || !bad.length) {
    if (!apply) console.log("Ništa nije upisano. Dodaj --apply za upis.");
    return;
  }

  // Stare vrednosti pre upisa — za eventualni povraćaj
  const backup = `non-issf-ids-backup-${Date.now()}.json`;
  writeFileSync(backup, JSON.stringify(bad, null, 2), { flag: "wx" });

  const updated = await db
    .update(shooters)
    .set({ issfId: null, issfSyncedAt: null })
    .where(inArray(shooters.id, bad.map((s) => s.id)))
    .returning({ id: shooters.id });

  console.log(`Obrisano: ${updated.length}. Backup: ${backup}`);
}

main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
