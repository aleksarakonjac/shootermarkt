/**
 * One-time backfill: add distance tags to competitions based on their results.
 * Run: npx tsx --env-file=.env.local src/lib/db/backfill-distance-tags.ts
 */
import "dotenv/config";
import { db } from "./index";
import { competitions, results, disciplines } from "./schema";
import { eq, sql } from "drizzle-orm";

const DISCIPLINE_DISTANCE_TAGS: Record<string, string> = {
  ARM: "10m", ARW: "10m", APM: "10m", APW: "10m",
  R3PM: "MK",  R3PW: "MK",  R3JM: "MK",  R3JW: "MK",
  SPW: "25m",  RFPM: "25m",
  FPM: "50m",
};

async function main() {
  const allComps = await db.select({ id: competitions.id, tags: competitions.tags }).from(competitions);
  const disciplineRows = await db.select({ id: disciplines.id, code: disciplines.code }).from(disciplines);
  const disciplineCodeById = Object.fromEntries(disciplineRows.map((d) => [d.id, d.code]));

  let updated = 0;
  for (const comp of allComps) {
    const compResults = await db
      .select({ disciplineId: results.disciplineId })
      .from(results)
      .where(eq(results.competitionId, comp.id));

    const codes = compResults.map((r) => disciplineCodeById[r.disciplineId]).filter(Boolean);
    const distanceTags = new Set<string>();
    for (const code of codes) {
      const t = DISCIPLINE_DISTANCE_TAGS[code];
      if (t) distanceTags.add(t);
    }
    if (distanceTags.has("50m") && distanceTags.has("25m")) distanceTags.add("50/25m");

    const newTags = [...distanceTags].filter((t) => !comp.tags.includes(t));
    if (newTags.length === 0) continue;

    const arrLiteral = `{${[...distanceTags].map((t) => `"${t}"`).join(",")}}`;
    await db.update(competitions)
      .set({ tags: sql`array(SELECT DISTINCT unnest(array_cat(${competitions.tags}, ${sql.raw(`'${arrLiteral}'`)}::varchar[])))` })
      .where(eq(competitions.id, comp.id));
    console.log(`[${comp.id}] +${newTags.join(", ")}`);
    updated++;
  }

  console.log(`Done. Updated ${updated}/${allComps.length} competitions.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
