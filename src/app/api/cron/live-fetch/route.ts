import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { competitions, competitionSchedule, disciplines, results, shooters } from "@/lib/db/schema";
import type { AgeCategory } from "@/lib/db/schema";
import { and, eq, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { fetchCompetitionResults, extractMvpEvents, fetchQualResultsFromHtml } from "@/lib/issf/adapter";
import { fetchLiveSiusResults, type SiusLiveResult } from "@/lib/sius/public-adapter";
import { matchShooter } from "@/lib/name-match";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - 4 * 60 * 60 * 1000);

  const activeSlots = await db
    .select({
      competitionId: competitionSchedule.competitionId,
      disciplineId: competitionSchedule.disciplineId,
      stage: competitionSchedule.stage,
      category: competitionSchedule.category,
      issfId: competitions.issfId,
      siusId: competitions.siusId,
      disciplineCode: disciplines.code,
    })
    .from(competitionSchedule)
    .innerJoin(competitions, eq(competitionSchedule.competitionId, competitions.id))
    .innerJoin(disciplines, eq(competitionSchedule.disciplineId, disciplines.id))
    .where(
      and(
        or(isNotNull(competitions.issfId), isNotNull(competitions.siusId)),
        lte(competitionSchedule.startTime, now),
        or(
          gte(competitionSchedule.endTime, now),
          and(
            isNull(competitionSchedule.endTime),
            gte(competitionSchedule.startTime, windowStart)
          )
        )
      )
    );

  console.log("[cron] active slots:", JSON.stringify(activeSlots.map((s) => ({ compId: s.competitionId, code: s.disciplineCode, stage: s.stage, siusId: s.siusId?.slice(0, 8), issfId: s.issfId }))));
  if (activeSlots.length === 0) {
    return NextResponse.json({ ok: true, active: 0, upserted: 0 });
  }

  const allShooters = await db
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      nationality: shooters.nationality,
      issfId: shooters.issfId,
    })
    .from(shooters);

  const shooterByIssfId = new Map(
    allShooters.filter((s) => s.issfId).map((s) => [s.issfId!, s.id])
  );

  let totalUpserted = 0;

  // Group slots by competition
  const byComp = new Map<number, typeof activeSlots>();
  for (const slot of activeSlots) {
    const list = byComp.get(slot.competitionId) ?? [];
    list.push(slot);
    byComp.set(slot.competitionId, list);
  }

  const counts = await Promise.all(
    [...byComp.entries()].map(async ([competitionId, slots]) => {
      const { siusId, issfId } = slots[0];
      const rows: Array<typeof results.$inferInsert> = [];

      if (siusId) {
        // ── SIUS primary source ─────────────────────────────────────────────
        const disciplineCodes = slots
          .filter((s) => s.stage.startsWith("qual"))
          .map((s) => s.disciplineCode);

        console.log("[cron] SIUS disciplineCodes:", disciplineCodes);
        let siusResults: Map<string, SiusLiveResult[]> = new Map();
        try {
          siusResults = await fetchLiveSiusResults(siusId, disciplineCodes);
          console.log("[cron] SIUS results keys:", [...siusResults.keys()], "sizes:", [...siusResults.values()].map((v) => v.length));
        } catch (e) {
          console.error("[cron] SIUS fetch failed:", e);
        }

        for (const slot of slots) {
          if (!slot.stage.startsWith("qual")) continue;
          const eventResults = siusResults.get(slot.disciplineCode);
          if (!eventResults?.length) continue;

          for (const r of eventResults) {
            const match = matchShooter(r.firstName, r.lastName, r.nation, allShooters);
            let shooterId: number;
            if (match.kind === "exact") {
              shooterId = match.id;
            } else if (r.siusAthleteId) {
              const [created] = await db
                .insert(shooters)
                .values({
                  firstName: r.firstName,
                  lastName: r.lastName,
                  nationality: r.nation || null,
                  verified: false,
                  createdBySelf: false,
                  siusAthleteId: r.siusAthleteId,
                })
                .onConflictDoUpdate({
                  target: [shooters.siusAthleteId],
                  set: { firstName: r.firstName, lastName: r.lastName, nationality: r.nation || null },
                })
                .returning({ id: shooters.id });
              shooterId = created.id;
              allShooters.push({ id: created.id, firstName: r.firstName, lastName: r.lastName, nationality: r.nation, issfId: null });
            } else {
              continue;
            }

            rows.push({
              shooterId,
              competitionId,
              disciplineId: slot.disciplineId,
              category: slot.category,
              qualTotal: r.total.toFixed(1),
              qualInners: r.inners ?? null,
              qualRank: r.rank,
              qualified: null,
              ...(r.series.length > 0 ? { qualDetail: { series: r.series } } : {}),
              source: "issf_import",
            });
          }
        }

        // if SIUS returned nothing, fall back to ISSF
        if (rows.length === 0 && issfId) {
          await fetchFromIssf(parseInt(issfId), slots, competitionId, allShooters, shooterByIssfId, rows);
        }
      } else if (issfId) {
        // ── ISSF only ───────────────────────────────────────────────────────
        await fetchFromIssf(parseInt(issfId), slots, competitionId, allShooters, shooterByIssfId, rows);
      }

      console.log(`[cron] comp ${competitionId}: ${rows.length} rows to upsert`);
      if (rows.length === 0) return 0;

      await db
        .insert(results)
        .values(rows)
        .onConflictDoUpdate({
          target: [results.shooterId, results.competitionId, results.disciplineId, results.category],
          set: {
            qualTotal: sql`excluded.qual_total`,
            qualInners: sql`excluded.qual_inners`,
            qualRank: sql`excluded.qual_rank`,
            qualified: sql`excluded.qualified`,
            qualDetail: sql`excluded.qual_detail`,
          },
        });

      return rows.length;
    })
  );

  totalUpserted = counts.reduce((a, b) => a + b, 0);

  return NextResponse.json({ ok: true, active: activeSlots.length, upserted: totalUpserted });
}

// ── ISSF HTML scraper (unchanged logic, extracted to helper) ──────────────────

async function fetchFromIssf(
  issfCompId: number,
  slots: Array<{ disciplineCode: string; stage: string; disciplineId: number; category: AgeCategory }>,
  competitionId: number,
  allShooters: Array<{ id: number; firstName: string; lastName: string; nationality: string | null; issfId: string | null }>,
  shooterByIssfId: Map<string, number>,
  rows: Array<typeof results.$inferInsert>
) {
  if (isNaN(issfCompId)) return;

  let groups;
  try {
    groups = await fetchCompetitionResults(issfCompId);
  } catch {
    return;
  }

  const mvpEvents = extractMvpEvents(groups);

  for (const slot of slots) {
    const isQual = slot.stage.startsWith("qual");
    const event = mvpEvents.find(
      (e) => e.disciplineCode === slot.disciplineCode && e.category === slot.category
    );
    if (!event) continue;

    const phase = isQual ? event.qualPhase : event.finalPhase;
    if (!phase?.resultKey) continue;

    let issfResults;
    try {
      issfResults = await fetchQualResultsFromHtml(issfCompId, phase.resultKey, true);
    } catch {
      continue;
    }

    if (issfResults.length === 0) continue;

    for (const r of issfResults) {
      let shooterId: number | undefined;
      if (r.issfId && shooterByIssfId.has(r.issfId)) {
        shooterId = shooterByIssfId.get(r.issfId)!;
      } else {
        const match = matchShooter(r.firstName, r.lastName, r.nationCode, allShooters);
        if (match.kind === "exact") shooterId = match.id;
      }
      if (!shooterId) continue;

      rows.push({
        shooterId,
        competitionId,
        disciplineId: slot.disciplineId,
        category: slot.category,
        qualTotal: r.total.toString(),
        qualInners: r.inners ?? null,
        qualRank: r.rank,
        qualified: r.qualified,
        ...(r.series.length > 0 ? { qualDetail: { series: r.series } } : {}),
        source: "issf_import",
      });
    }
  }
}
