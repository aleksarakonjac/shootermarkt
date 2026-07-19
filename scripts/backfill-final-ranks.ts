/**
 * Popunjava rang posle svakog dostupnog koraka finala iz postojećih kumulativnih rezultata.
 * Podrazumevano samo prikazuje šta bi promenio; dodaj --apply za upis.
 */
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { results, type BulletinFinalDetail, type FinalDetail } from "../src/lib/db/schema";
import { deriveFinalRankProgression } from "../src/lib/pdf-import/types";

const apply = process.argv.includes("--apply");

function isBulletinFinal(detail: FinalDetail | null): detail is BulletinFinalDetail {
  return detail?.format === "bulletin";
}

function sameRanks(a: Array<number | null> | undefined, b: Array<number | null>) {
  return a?.length === b.length && a.every((value, index) => value === b[index]);
}

async function main() {
  const rows = await db.select({
    id: results.id,
    competitionId: results.competitionId,
    disciplineId: results.disciplineId,
    category: results.category,
    finalDetail: results.finalDetail,
  }).from(results);
  const groups = new Map<string, typeof rows>();
  let detailedFinals = 0;

  for (const row of rows) {
    if (!isBulletinFinal(row.finalDetail) || !row.finalDetail.cumulative?.length) continue;
    detailedFinals++;
    const key = `${row.competitionId}:${row.disciplineId}:${row.category}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  let updated = 0;
  for (const group of groups.values()) {
    const cumulative = group.map((row) => row.finalDetail?.cumulative);
    for (const row of group) {
      const ranks = deriveFinalRankProgression(row.finalDetail!.cumulative, cumulative);
      if (!ranks?.some((rank) => rank != null) || sameRanks(row.finalDetail!.ranks, ranks)) continue;
      updated++;
      if (apply) {
        await db.update(results)
          .set({ finalDetail: { ...row.finalDetail!, ranks } })
          .where(eq(results.id, row.id));
      }
    }
  }

  console.log(`Finala sa kumulativnim podacima: ${detailedFinals} u ${groups.size} grupa.`);
  console.log(`${apply ? "Ažurirano" : "Za ažuriranje"}: ${updated} rezultata.`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
