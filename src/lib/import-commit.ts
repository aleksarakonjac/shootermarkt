import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubs, competitions, disciplines, results, shooters } from "@/lib/db/schema";
import { recomputeFormaCache } from "@/lib/forma-cache";
import { matchShooter } from "@/lib/name-match";
import { DISCIPLINE_META, type CommitPayload } from "@/lib/pdf-import/types";

const DISTANCE_TAGS: Record<string, string[]> = {
  ARM: ["10m"], ARW: ["10m"], APM: ["10m"], APW: ["10m"],
  R3PM: ["25m", "50m"], R3PW: ["25m", "50m"], R3JM: ["25m", "50m"], R3JW: ["25m", "50m"],
  SPW: ["25m"], RFPM: ["25m"], FPM: ["50m"],
};

export class CommitValidationError extends Error {}

export type CommitResult = {
  inserted: number;
  skipped: number;
  errors: string[];
  competitionId: number;
};

function distanceTags(codes: string[]) {
  return [...new Set(codes.flatMap((code) => DISTANCE_TAGS[code] ?? []))];
}

async function addCompetitionTags(competitionId: number, tags: string[]) {
  if (!tags.length) return;
  const tagArray = sql`ARRAY[${sql.join(tags.map((tag) => sql`${tag}`), sql`, `)}]::varchar[]`;
  await db.update(competitions).set({
    tags: sql`array(SELECT DISTINCT unnest(array_cat(${competitions.tags}, ${tagArray})))`,
  }).where(eq(competitions.id, competitionId));
}

/** Commits reviewed individual result rows and refreshes their forma cache. */
export async function commitImportReview(payload: CommitPayload): Promise<CommitResult> {
  const { competition: comp, rows } = payload;
  const competitionTags = payload.tags ?? comp?.tags ?? [];
  let competitionId: number;

  if (payload.competitionId) {
    competitionId = payload.competitionId;
    await addCompetitionTags(competitionId, competitionTags);
  } else {
    if (!comp?.name || !comp.date || !comp.level) {
      throw new CommitValidationError("Izaberi takmičenje ili popuni podatke");
    }
    const existing = await db.query.competitions.findFirst({
      where: and(eq(competitions.name, comp.name), eq(competitions.date, comp.date)),
    });
    if (existing) {
      competitionId = existing.id;
      await addCompetitionTags(competitionId, competitionTags);
    } else {
      const [created] = await db.insert(competitions).values({
        name: comp.name, date: comp.date, dateEnd: comp.dateEnd ?? null,
        location: comp.location, level: comp.level, eventType: comp.eventType ?? "other",
        organizer: comp.organizer ?? null, tags: competitionTags,
      }).returning({ id: competitions.id });
      competitionId = created.id;
    }
  }

  const disciplineMap = Object.fromEntries((await db.select().from(disciplines)).map((d) => [d.code, d.id]));
  const allShooters = await db.select({
    id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName,
    nationality: shooters.nationality, clubId: shooters.clubId,
    birthYear: shooters.birthYear, apparatus: shooters.apparatus,
  }).from(shooters);
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];
  const affectedShooterIds = new Set<number>();

  for (const row of rows) {
    if (row.skip) { skipped++; continue; }
    try {
      let clubId = row.clubId;
      if (!clubId && row.clubAbbr) {
        const existing = await db.query.clubs.findFirst({ where: eq(clubs.nocCode, row.clubAbbr) });
        if (existing) clubId = existing.id;
        else {
          const [created] = await db.insert(clubs).values({
            name: row.clubAbbr, nocCode: row.clubAbbr, countryCode: row.teamNoc,
          }).returning({ id: clubs.id });
          clubId = created.id;
        }
      }

      let shooterId = row.shooterId;
      if (!shooterId) {
        const match = matchShooter(row.firstName, row.lastName, row.teamNoc || null, allShooters);
        const existing = match.kind === "exact" ? allShooters.find((shooter) => shooter.id === match.id) : undefined;
        if (existing) {
          shooterId = existing.id;
          const patch: Partial<typeof shooters.$inferInsert> = {};
          if (!existing.clubId && clubId) patch.clubId = clubId;
          if (!existing.birthYear && row.birthYear) patch.birthYear = row.birthYear;
          if (!existing.apparatus && (row.apparatus ?? DISCIPLINE_META[row.disciplineCode]?.apparatus)) {
            patch.apparatus = row.apparatus ?? DISCIPLINE_META[row.disciplineCode].apparatus;
          }
          if (Object.keys(patch).length) await db.update(shooters).set(patch).where(eq(shooters.id, existing.id));
        } else {
          const meta = DISCIPLINE_META[row.disciplineCode];
          const [created] = await db.insert(shooters).values({
            firstName: row.firstName, lastName: row.lastName, nationality: row.teamNoc || null,
            birthYear: row.birthYear ?? null, gender: row.gender ?? meta?.gender ?? null,
            apparatus: row.apparatus ?? meta?.apparatus ?? null, clubId: clubId ?? null,
            createdBySelf: false, verified: false,
          }).returning({ id: shooters.id });
          shooterId = created.id;
          allShooters.push({
            id: created.id, firstName: row.firstName, lastName: row.lastName,
            nationality: row.teamNoc || null, clubId: clubId ?? null,
            birthYear: row.birthYear ?? null, apparatus: row.apparatus ?? meta?.apparatus ?? null,
          });
        }
      }
      if (shooterId) affectedShooterIds.add(shooterId);

      const disciplineId = disciplineMap[row.disciplineCode];
      if (!disciplineId) { errors.push(`Unknown discipline: ${row.disciplineCode}`); continue; }
      const isElimOnly = row.elimRound != null && row.qualTotal == null;
      const values = {
        shooterId, competitionId, disciplineId,
        category: (row.category ?? "senior") as typeof results.$inferInsert.category,
        clubId: clubId ?? null,
        qualTotal: row.qualTotal?.toString() ?? null, qualInners: row.qualInners ?? null, qualRank: row.qualRank ?? null,
        qualDetail: row.qualPositions
          ? { kneeling: row.qualPositions.kneeling, prone: row.qualPositions.prone, standing: row.qualPositions.standing }
          : row.qualSeries ? { series: row.qualSeries } : null,
        qualified: row.qualified ?? null,
        elimRound: row.elimRound ?? null, elimTotal: row.elimTotal != null ? Math.round(row.elimTotal) : null,
        elimRank: row.elimRank ?? null,
        elimDetail: row.elimSeries || row.elimInners != null
          ? { ...(row.elimSeries ? { series: row.elimSeries.map(Math.round) } : { series: [] }), inners: row.elimInners ?? null } : null,
        finalTotal: row.finalTotal?.toString() ?? null, finalRank: row.finalRank ?? null,
        finalDetail: row.finalSeries || row.finalShots || row.finalCumulative || row.finalShotsByStage
          ? { format: "bulletin" as const, scoring: (row.finalScoring ?? "decimal") as "decimal" | "hit_count",
              ...(row.finalSeries ? { series: row.finalSeries } : {}), ...(row.finalSeriesLabels ? { seriesLabels: row.finalSeriesLabels } : {}),
              ...(row.finalShots ? { shots: row.finalShots } : {}), ...(row.finalShotsByStage ? { shotsByStage: row.finalShotsByStage } : {}),
              ...(row.finalCumulative ? { cumulative: row.finalCumulative } : {}), ...(row.finalRanks ? { ranks: row.finalRanks } : {}),
              ...(row.finalShootOff ? { shootOff: true } : {}) } : null,
        ...(isElimOnly ? { elimRemark: row.remark ?? null } : { qualRemark: row.remark ?? null }),
        source: payload.source ?? "pdf_import",
      };
      if (isElimOnly) {
        await db.insert(results).values(values).onConflictDoUpdate({
          target: [results.shooterId, results.competitionId, results.disciplineId, results.category],
          set: { elimRound: sql`excluded.elim_round`, elimTotal: sql`excluded.elim_total`, elimRank: sql`excluded.elim_rank`, elimDetail: sql`excluded.elim_detail` },
        });
      } else await db.insert(results).values(values).onConflictDoNothing();
      inserted++;
    } catch (error) {
      errors.push(`${row.lastName} ${row.firstName} (${row.teamNoc}): ${String(error)}`);
    }
  }

  await addCompetitionTags(competitionId, distanceTags(rows.filter((row) => !row.skip).map((row) => row.disciplineCode)));
  const affectedIds = [...affectedShooterIds];
  if (affectedIds.length) {
    try {
      await recomputeFormaCache(affectedIds);
    } catch (error) {
      // Result import succeeded, but public rankings can remain stale until the next recompute.
      errors.push(`[forma-cache] ${String(error)}`);
    }
  }
  return { inserted, skipped, errors, competitionId };
}
