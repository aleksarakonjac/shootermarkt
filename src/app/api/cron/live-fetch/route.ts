import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { competitions, competitionSchedule, disciplines, mixedTeamResults, results, shooters } from "@/lib/db/schema";
import type { AgeCategory } from "@/lib/db/schema";
import { and, eq, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { fetchCompetitionResults, extractMvpEvents, fetchQualResultsFromHtml, fetchElimResultsFromHtml, extractMixedTeamEvents, fetchMixedTeamQualFromHtml, fetchMixedTeamFinalFromHtml } from "@/lib/issf/adapter";
import { fetchLiveSiusResults, fetchLiveSiusMixedTeamResults, mixedTeamIdentity, MIXED_TEAM_CODES, type SiusLiveData, type SiusTeamResult } from "@/lib/sius/public-adapter";
import { matchShooter } from "@/lib/name-match";
import { recomputeFormaCache } from "@/lib/forma-cache";

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

  let mixedUpserted = 0;

  if (siusId) {
    // Mixed team (ARMT/APMT) writes to mixed_team_results, not results —
    // handle it separately, then fall through to the individual-discipline path.
    const mixedSlots = dedupedSlots.filter((s) => MIXED_TEAM_CODES.has(s.disciplineCode));
    if (mixedSlots.length > 0) {
      mixedUpserted = await processMixedTeamSlots(competitionId, siusId, issfId, mixedSlots, allShooters, shooterByIssfId);
    }

    // ── SIUS primary source ─────────────────────────────────────────────
    const disciplineCodes = [...new Set(
      dedupedSlots.filter((s) => !MIXED_TEAM_CODES.has(s.disciplineCode)).map((s) => s.disciplineCode)
    )];

    console.log("[cron] SIUS disciplineCodes:", disciplineCodes);
    let siusData: Map<string, SiusLiveData> = new Map();
    if (disciplineCodes.length > 0) {
      try {
        siusData = await fetchLiveSiusResults(siusId, disciplineCodes);
        console.log("[cron] SIUS data:", [...siusData.entries()].map(([k, v]) => `${k}: qual=${v.qual.length} elim=${v.elim.length} final=${v.final.length}`));
      } catch (e) {
        console.error("[cron] SIUS fetch failed:", e);
      }
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

      if (slot.stage === "final" && eventData.final.length > 0) {
        for (const r of eventData.final) {
          const shooterId = await resolveOrCreateShooter(r, allShooters);
          if (!shooterId) continue;
          rows.push({
            shooterId,
            competitionId,
            disciplineId: slot.disciplineId,
            category: slot.category,
            finalTotal: r.total.toFixed(1),
            finalRank: r.rank,
            finalRemark: r.remark,
            ...(r.series.length > 0 ? { finalDetail: { format: "bulletin", scoring: "decimal", series: r.series } } : {}),
            source: "issf_import",
          });
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

    const mixedSlots = dedupedSlots.filter((s) => MIXED_TEAM_CODES.has(s.disciplineCode));
    if (mixedSlots.length > 0) {
      mixedUpserted = await processMixedTeamSlots(competitionId, null, issfId, mixedSlots, allShooters, shooterByIssfId);
    }
  }

  // Defensive dedup: a single insert batch can't touch the same
  // (shooter, comp, disc, cat) conflict target twice — Postgres throws
  // "ON CONFLICT DO UPDATE command cannot affect row a second time" and
  // fails the whole batch. Merge stages into one row per key.
  const dedupedRows = [...rows.reduce((byKey, row) => {
    const key = `${row.shooterId}|${row.competitionId}|${row.disciplineId}|${row.category}`;
    byKey.set(key, { ...byKey.get(key), ...row });
    return byKey;
  }, new Map<string, typeof results.$inferInsert>()).values()];

  console.log(`[cron] comp ${competitionId}: ${rows.length} rows fetched, ${dedupedRows.length} after dedup`);
  if (dedupedRows.length === 0) return mixedUpserted;

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
          finalTotal: sql`coalesce(excluded.final_total, ${results.finalTotal})`,
          finalRank: sql`coalesce(excluded.final_rank, ${results.finalRank})`,
          finalDetail: sql`coalesce(excluded.final_detail, ${results.finalDetail})`,
          finalRemark: sql`coalesce(excluded.final_remark, ${results.finalRemark})`,
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

  await recomputeFormaCache([...new Set(dedupedRows.map((row) => row.shooterId))]);

  return dedupedRows.length + mixedUpserted;
}

// ── Mixed team (ARMT / APMT) ─────────────────────────────────────────────────

async function processMixedTeamSlots(
  competitionId: number,
  siusId: string | null,
  issfId: string | null,
  mixedSlots: Array<{ disciplineId: number; stage: string; disciplineCode: string }>,
  allShooters: Array<{ id: number; firstName: string; lastName: string; nationality: string | null; issfId: string | null }>,
  shooterByIssfId: Map<string, number>
): Promise<number> {
  const disciplineCodes = [...new Set(mixedSlots.map((s) => s.disciplineCode))];
  const rows: Array<typeof mixedTeamResults.$inferInsert> = [];
  const teamNumbersByDiscipline = new Map<string, Map<string, number>>();
  const nocCountsByDiscipline = new Map<string, Map<string, number>>();

  if (siusId) {
    let siusData;
    try {
      siusData = await fetchLiveSiusMixedTeamResults(siusId, disciplineCodes);
    } catch (e) {
      console.error("[cron] SIUS mixed-team fetch failed:", e);
      siusData = new Map();
    }

    for (const slot of mixedSlots) {
      const eventData = siusData.get(slot.disciplineCode);
      if (!eventData) continue;

      const teamNumbers = teamNumbersByDiscipline.get(slot.disciplineCode) ?? new Map<string, number>();
      teamNumbersByDiscipline.set(slot.disciplineCode, teamNumbers);
      const nocCounts = nocCountsByDiscipline.get(slot.disciplineCode) ?? new Map<string, number>();
      nocCountsByDiscipline.set(slot.disciplineCode, nocCounts);
      const teamNumberFor = (r: SiusTeamResult) => {
        const identity = mixedTeamIdentity(r.athletes);
        const existing = teamNumbers.get(identity);
        if (existing) return existing;
        const teamNumber = (nocCounts.get(r.nocCode) ?? 0) + 1;
        nocCounts.set(r.nocCode, teamNumber);
        teamNumbers.set(identity, teamNumber);
        return teamNumber;
      };

      const push = async (r: SiusTeamResult, isFinal: boolean) => {
        const [a1, a2] = r.athletes;
        const shooter1Id = a1 ? await resolveOrCreateShooter({ ...a1, nation: r.nocCode }, allShooters) : null;
        const shooter2Id = a2 ? await resolveOrCreateShooter({ ...a2, nation: r.nocCode }, allShooters) : null;
        rows.push({
          competitionId,
          disciplineId: slot.disciplineId,
          nocCode: r.nocCode,
          teamNumber: teamNumberFor(r),
          shooter1Id,
          shooter2Id,
          shooter1Name: a1 ? `${a1.lastName} ${a1.firstName}`.trim() : null,
          shooter2Name: a2 ? `${a2.lastName} ${a2.firstName}`.trim() : null,
          ...(a1 ? { shooter1Detail: { series: a1.series, inners: a1.inners, total: a1.total } } : {}),
          ...(a2 ? { shooter2Detail: { series: a2.series, inners: a2.inners, total: a2.total } } : {}),
          ...(isFinal
            ? { finalRank: r.rank, finalTotal: r.total.toFixed(1), finalRemark: r.remark }
            : { qualRank: r.rank, qualTotal: r.total.toFixed(1), qualInners: r.inners, qualified: r.qualified || null, qualRemark: r.remark }),
          source: "issf_import",
        });
      };

      if (slot.stage.startsWith("qual")) for (const r of eventData.qual) await push(r, false);
      if (slot.stage === "final" || slot.stage === "elimination") for (const r of eventData.final) await push(r, true);
    }
  }

  // SIUS gave nothing (not scheduled there, or no siusId at all) — fall back to
  // the ISSF HTML scraper, same as the individual-discipline path above.
  if (rows.length === 0 && issfId) {
    await fetchMixedTeamFromIssf(parseInt(issfId), mixedSlots, competitionId, allShooters, shooterByIssfId, rows);
  }

  // Same (comp, disc, noc, teamNumber) can appear from both a qual and a final
  // slot in one run — merge instead of letting the batch insert collide.
  const merged = new Map<string, typeof mixedTeamResults.$inferInsert>();
  for (const r of rows) {
    const key = `${r.competitionId}|${r.disciplineId}|${r.nocCode}|${r.teamNumber}`;
    merged.set(key, { ...merged.get(key), ...r });
  }
  const dedupedRows = [...merged.values()];
  if (dedupedRows.length === 0) return 0;

  await db
    .insert(mixedTeamResults)
    .values(dedupedRows)
    .onConflictDoUpdate({
      target: [mixedTeamResults.competitionId, mixedTeamResults.disciplineId, mixedTeamResults.nocCode, mixedTeamResults.teamNumber],
      set: {
        shooter1Id: sql`coalesce(excluded.shooter1_id, ${mixedTeamResults.shooter1Id})`,
        shooter2Id: sql`coalesce(excluded.shooter2_id, ${mixedTeamResults.shooter2Id})`,
        shooter1Name: sql`excluded.shooter1_name`,
        shooter2Name: sql`excluded.shooter2_name`,
        shooter1Detail: sql`coalesce(excluded.shooter1_detail, ${mixedTeamResults.shooter1Detail})`,
        shooter2Detail: sql`coalesce(excluded.shooter2_detail, ${mixedTeamResults.shooter2Detail})`,
        qualRank: sql`coalesce(excluded.qual_rank, ${mixedTeamResults.qualRank})`,
        qualTotal: sql`coalesce(excluded.qual_total, ${mixedTeamResults.qualTotal})`,
        qualInners: sql`coalesce(excluded.qual_inners, ${mixedTeamResults.qualInners})`,
        qualified: sql`coalesce(excluded.qualified, ${mixedTeamResults.qualified})`,
        qualRemark: sql`coalesce(excluded.qual_remark, ${mixedTeamResults.qualRemark})`,
        finalRank: sql`coalesce(excluded.final_rank, ${mixedTeamResults.finalRank})`,
        finalTotal: sql`coalesce(excluded.final_total, ${mixedTeamResults.finalTotal})`,
        finalRemark: sql`coalesce(excluded.final_remark, ${mixedTeamResults.finalRemark})`,
      },
    });

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

// ── ISSF HTML scraper (mixed team) ───────────────────────────────────────────

async function fetchMixedTeamFromIssf(
  issfCompId: number,
  slots: Array<{ disciplineCode: string; stage: string; disciplineId: number }>,
  competitionId: number,
  allShooters: Array<{ id: number; firstName: string; lastName: string; nationality: string | null; issfId: string | null }>,
  shooterByIssfId: Map<string, number>,
  rows: Array<typeof mixedTeamResults.$inferInsert>
) {
  if (isNaN(issfCompId)) return;

  let groups;
  try {
    groups = await fetchCompetitionResults(issfCompId);
  } catch {
    return;
  }

  const mixedEvents = extractMixedTeamEvents(groups);
  const resolveId = (issfId: string | null, firstName: string, lastName: string, nocCode: string) => {
    if (issfId && shooterByIssfId.has(issfId)) return shooterByIssfId.get(issfId)!;
    const m = matchShooter(firstName, lastName, nocCode, allShooters);
    return m.kind === "exact" ? m.id : null;
  };

  for (const slot of slots) {
    const event = mixedEvents.find((e) => e.disciplineCode === slot.disciplineCode);
    if (!event) continue;

    // Same nation can enter 2 teams — number them in table order, and match
    // final rows back to their qual entry by shared athlete issfId (nocCode
    // alone can't tell the 2 teams apart).
    const nocCounts = new Map<string, number>();
    const teamRows: Array<typeof mixedTeamResults.$inferInsert & { mIssfId: string | null; fIssfId: string | null }> = [];

    if (slot.stage.startsWith("qual") && event.qualPhase?.resultKey) {
      let qualResults;
      try {
        qualResults = await fetchMixedTeamQualFromHtml(issfCompId, event.qualPhase.resultKey, true);
      } catch { continue; }

      for (const r of qualResults) {
        const teamNumber = (nocCounts.get(r.nocCode) ?? 0) + 1;
        nocCounts.set(r.nocCode, teamNumber);
        teamRows.push({
          competitionId,
          disciplineId: slot.disciplineId,
          nocCode: r.nocCode,
          teamNumber,
          mIssfId: r.mIssfId,
          fIssfId: r.fIssfId,
          shooter1Id: resolveId(r.mIssfId, r.mFirstName, r.mLastName, r.nocCode),
          shooter2Id: resolveId(r.fIssfId, r.fFirstName, r.fLastName, r.nocCode),
          shooter1Name: `${r.mLastName} ${r.mFirstName}`.trim() || null,
          shooter2Name: `${r.fLastName} ${r.fFirstName}`.trim() || null,
          shooter1Detail: { series: r.mSeries, inners: r.mInners, total: r.mTotal },
          shooter2Detail: { series: r.fSeries, inners: r.fInners, total: r.fTotal },
          qualRank: r.rank,
          qualTotal: r.total.toString(),
          qualInners: r.inners,
          qualified: r.qualified,
          source: "issf_import",
        });
      }
    }

    if ((slot.stage === "final" || slot.stage === "elimination") && event.finalPhase?.resultKey) {
      let finalResults;
      try {
        finalResults = await fetchMixedTeamFinalFromHtml(issfCompId, event.finalPhase.resultKey, true);
      } catch { continue; }

      for (const r of finalResults) {
        const existing = teamRows.find(
          (t) => t.nocCode === r.nocCode &&
            ((r.mIssfId && t.mIssfId === r.mIssfId) || (r.fIssfId && t.fIssfId === r.fIssfId))
        );
        if (existing) {
          existing.finalRank = r.rank;
          existing.finalTotal = r.total.toFixed(1);
        } else {
          const teamNumber = (nocCounts.get(r.nocCode) ?? 0) + 1;
          nocCounts.set(r.nocCode, teamNumber);
          teamRows.push({
            competitionId,
            disciplineId: slot.disciplineId,
            nocCode: r.nocCode,
            teamNumber,
            mIssfId: r.mIssfId,
            fIssfId: r.fIssfId,
            shooter1Id: resolveId(r.mIssfId, r.mFirstName, r.mLastName, r.nocCode),
            shooter2Id: resolveId(r.fIssfId, r.fFirstName, r.fLastName, r.nocCode),
            shooter1Name: `${r.mLastName} ${r.mFirstName}`.trim() || null,
            shooter2Name: `${r.fLastName} ${r.fFirstName}`.trim() || null,
            finalRank: r.rank,
            finalTotal: r.total.toFixed(1),
            source: "issf_import",
          });
        }
      }
    }

    rows.push(...teamRows.map(({ mIssfId: _m, fIssfId: _f, ...row }) => row));
  }
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
