import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { competitions, competitionSchedule, disciplines, results, shooters } from "@/lib/db/schema";
import type { AgeCategory } from "@/lib/db/schema";
import { and, eq, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { fetchCompetitionResults, extractMvpEvents, fetchQualResultsFromHtml, fetchElimResultsFromHtml } from "@/lib/issf/adapter";
import { fetchLiveSiusResults, type SiusLiveData } from "@/lib/sius/public-adapter";
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
          gte(competitionSchedule.endTime, windowStart),
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
      try {
        return await processCompetition(competitionId, slots, allShooters, shooterByIssfId);
      } catch (e) {
        console.error(`[cron] comp ${competitionId} failed:`, e);
        return 0;
      }
    })
  );

  totalUpserted = counts.reduce((a, b) => a + b, 0);

  return NextResponse.json({ ok: true, active: activeSlots.length, upserted: totalUpserted });
}

async function processCompetition(
  competitionId: number,
  slots: Array<{ competitionId: number; disciplineId: number; stage: string; category: AgeCategory; issfId: string | null; siusId: string | null; disciplineCode: string }>,
  allShooters: Array<{ id: number; firstName: string; lastName: string; nationality: string | null; issfId: string | null }>,
  shooterByIssfId: Map<string, number>
): Promise<number> {
  const { siusId, issfId } = slots[0];
  const rows: Array<typeof results.$inferInsert> = [];

  // A discipline/category can have multiple "qual" schedule rows at different
  // times (e.g. SPW: precizna + brza paljba are separate time slots but share
  // one combined qual ranking). SIUS already returns that merged qual result
  // under a single discipline code, so collapse the schedule rows down to one
  // slot per (discipline, category, stage-kind) before processing — otherwise
  // we'd push the same merged result twice into one insert batch.
  const dedupedSlots = [...new Map(
    slots.map((s) => [`${s.disciplineId}|${s.category}|${s.stage.startsWith("qual") ? "qual" : s.stage}`, s])
  ).values()];

  if (siusId) {
    // ── SIUS primary source ─────────────────────────────────────────────
    const disciplineCodes = [...new Set(dedupedSlots.map((s) => s.disciplineCode))];

    console.log("[cron] SIUS disciplineCodes:", disciplineCodes);
    let siusData: Map<string, SiusLiveData> = new Map();
    try {
      siusData = await fetchLiveSiusResults(siusId, disciplineCodes);
      console.log("[cron] SIUS data:", [...siusData.entries()].map(([k, v]) => `${k}: qual=${v.qual.length} elim=${v.elim.length}`));
    } catch (e) {
      console.error("[cron] SIUS fetch failed:", e);
    }

    for (const slot of dedupedSlots) {
      const eventData = siusData.get(slot.disciplineCode);
      if (!eventData) continue;

      if (slot.stage.startsWith("qual") && eventData.qual.length > 0) {
        for (const r of eventData.qual) {
          const shooterId = await resolveOrCreateShooter(r, allShooters);
          if (!shooterId) continue;
          rows.push({
            shooterId,
            competitionId,
            disciplineId: slot.disciplineId,
            category: slot.category,
            qualTotal: r.total.toFixed(1),
            qualInners: r.inners ?? null,
            qualRank: r.rank,
            qualified: r.qualified || null,
            qualRemark: r.remark,
            ...(r.series.length > 0 ? { qualDetail: { series: r.series } } : {}),
            source: "issf_import",
          });
        }
      }

      if (slot.stage === "elimination") {
        for (const { round, results: elimResults } of eventData.elim) {
          for (const r of elimResults) {
            const shooterId = await resolveOrCreateShooter(r, allShooters);
            if (!shooterId) continue;
            rows.push({
              shooterId,
              competitionId,
              disciplineId: slot.disciplineId,
              category: slot.category,
              elimRound: round,
              elimTotal: Math.round(r.total),
              elimRank: r.rank,
              elimDetail: { series: r.series.map(Math.round), inners: r.inners },
              qualified: r.qualified || null,
              elimRemark: r.remark,
              source: "issf_import",
            });
          }
        }
      }
    }

    // if SIUS returned nothing, fall back to ISSF
    if (rows.length === 0 && issfId) {
      await fetchFromIssf(parseInt(issfId), dedupedSlots, competitionId, allShooters, shooterByIssfId, rows);
    }
  } else if (issfId) {
    // ── ISSF only ───────────────────────────────────────────────────────
    await fetchFromIssf(parseInt(issfId), dedupedSlots, competitionId, allShooters, shooterByIssfId, rows);
  }

  // Defensive dedup: a single insert batch can't touch the same
  // (shooter, comp, disc, cat) conflict target twice — Postgres throws
  // "ON CONFLICT DO UPDATE command cannot affect row a second time" and
  // fails the whole batch. Keep the last occurrence per key.
  const dedupedRows = [...new Map(
    rows.map((r) => [`${r.shooterId}|${r.competitionId}|${r.disciplineId}|${r.category}`, r])
  ).values()];

  console.log(`[cron] comp ${competitionId}: ${rows.length} rows fetched, ${dedupedRows.length} after dedup`);
  if (dedupedRows.length === 0) return 0;

  // Qual rows: upsert by (shooter, comp, disc, cat)
  const qualRows = dedupedRows.filter((r) => r.elimRound == null);
  const elimRowsToInsert = dedupedRows.filter((r) => r.elimRound != null);

  if (qualRows.length > 0) {
    await db
      .insert(results)
      .values(qualRows)
      .onConflictDoUpdate({
        target: [results.shooterId, results.competitionId, results.disciplineId, results.category],
        set: {
          qualTotal: sql`excluded.qual_total`,
          qualInners: sql`excluded.qual_inners`,
          qualRank: sql`excluded.qual_rank`,
          // SIUS only tags QualificationRemark/StatusRemark once that shooter's
          // status is officially decided — until then the row has neither, so
          // we push null. Coalesce so an in-progress fetch never clobbers an
          // already-decided flag from an earlier run (or the ISSF path).
          qualified: sql`coalesce(excluded.qualified, ${results.qualified})`,
          qualRemark: sql`coalesce(excluded.qual_remark, ${results.qualRemark})`,
          qualDetail: sql`excluded.qual_detail`,
        },
      });
  }

  // Elim rows: upsert by (shooter, comp, disc, cat) — elim_round stored on the existing row
  // Each shooter appears in exactly one elim round so this updates the single row.
  for (const row of elimRowsToInsert) {
    await db
      .insert(results)
      .values(row)
      .onConflictDoUpdate({
        target: [results.shooterId, results.competitionId, results.disciplineId, results.category],
        set: {
          elimRound: sql`excluded.elim_round`,
          elimTotal: sql`excluded.elim_total`,
          elimRank: sql`excluded.elim_rank`,
          elimDetail: sql`excluded.elim_detail`,
          qualified: sql`coalesce(excluded.qualified, ${results.qualified})`,
          elimRemark: sql`coalesce(excluded.elim_remark, ${results.elimRemark})`,
        },
      });
  }

  return dedupedRows.length;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

async function resolveOrCreateShooter(
  r: { firstName: string; lastName: string; nation?: string; siusAthleteId?: string | null },
  allShooters: Array<{ id: number; firstName: string; lastName: string; nationality: string | null; issfId: string | null }>
): Promise<number | null> {
  const match = matchShooter(r.firstName, r.lastName, r.nation ?? null, allShooters);
  if (match.kind === "exact") return match.id;

  if (r.siusAthleteId) {
    const [created] = await db
      .insert(shooters)
      .values({
        firstName: r.firstName,
        lastName: r.lastName,
        nationality: r.nation ?? null,
        verified: false,
        createdBySelf: false,
        siusAthleteId: r.siusAthleteId,
      })
      .onConflictDoUpdate({
        target: [shooters.siusAthleteId],
        set: { firstName: r.firstName, lastName: r.lastName, nationality: r.nation ?? null },
      })
      .returning({ id: shooters.id });
    allShooters.push({ id: created.id, firstName: r.firstName, lastName: r.lastName, nationality: r.nation ?? null, issfId: null });
    return created.id;
  }

  return null;
}

// ── ISSF HTML scraper ─────────────────────────────────────────────────────────

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
    const event = mvpEvents.find(
      (e) => e.disciplineCode === slot.disciplineCode && e.category === slot.category
    );
    if (!event) continue;

    if (slot.stage.startsWith("qual") && event.qualPhase?.resultKey) {
      let issfResults;
      try {
        issfResults = await fetchQualResultsFromHtml(issfCompId, event.qualPhase.resultKey, true);
      } catch { continue; }

      for (const r of issfResults) {
        const shooterId = r.issfId && shooterByIssfId.has(r.issfId)
          ? shooterByIssfId.get(r.issfId)!
          : (() => { const m = matchShooter(r.firstName, r.lastName, r.nationCode, allShooters); return m.kind === "exact" ? m.id : undefined; })();
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

    if (slot.stage === "elimination" && event.elimPhases.length > 0) {
      for (const { round, phase } of event.elimPhases) {
        if (!phase.resultKey) continue;
        let issfResults;
        try {
          issfResults = await fetchElimResultsFromHtml(issfCompId, phase.resultKey, true);
        } catch { continue; }

        for (const r of issfResults) {
          const shooterId = r.issfId && shooterByIssfId.has(r.issfId)
            ? shooterByIssfId.get(r.issfId)!
            : (() => { const m = matchShooter(r.firstName, r.lastName, r.nationCode, allShooters); return m.kind === "exact" ? m.id : undefined; })();
          if (!shooterId) continue;

          rows.push({
            shooterId,
            competitionId,
            disciplineId: slot.disciplineId,
            category: slot.category,
            elimRound: round,
            elimTotal: Math.round(r.total),
            elimRank: r.rank,
            elimDetail: { series: r.series.map(Math.round), inners: r.inners },
            qualified: r.qualified,
            source: "issf_import",
          });
        }
      }
    }
  }
}
