import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { competitions, competitionSchedule, disciplines, results, shooters } from "@/lib/db/schema";
import { and, eq, isNotNull, lte, or, sql } from "drizzle-orm";
import { fetchCompetitionResults, extractMvpEvents, fetchQualResultsFromHtml } from "@/lib/issf/adapter";
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
      disciplineCode: disciplines.code,
    })
    .from(competitionSchedule)
    .innerJoin(competitions, eq(competitionSchedule.competitionId, competitions.id))
    .innerJoin(disciplines, eq(competitionSchedule.disciplineId, disciplines.id))
    .where(
      and(
        isNotNull(competitions.issfId),
        lte(competitionSchedule.startTime, now),
        or(
          sql`${competitionSchedule.endTime} >= ${now}`,
          sql`${competitionSchedule.endTime} IS NULL AND ${competitionSchedule.startTime} >= ${windowStart}`
        )
      )
    );

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

  // Group by competition to avoid redundant ISSF API calls
  const byComp = new Map<number, typeof activeSlots>();
  for (const slot of activeSlots) {
    const list = byComp.get(slot.competitionId) ?? [];
    list.push(slot);
    byComp.set(slot.competitionId, list);
  }

  for (const [competitionId, slots] of byComp) {
    const issfCompId = parseInt(slots[0].issfId!);
    if (isNaN(issfCompId)) continue;

    let groups;
    try {
      groups = await fetchCompetitionResults(issfCompId);
    } catch {
      continue;
    }

    const mvpEvents = extractMvpEvents(groups);
    const rows: Array<typeof results.$inferInsert> = [];

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

    if (rows.length === 0) continue;

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

    totalUpserted += rows.length;
  }

  return NextResponse.json({ ok: true, active: activeSlots.length, upserted: totalUpserted });
}
