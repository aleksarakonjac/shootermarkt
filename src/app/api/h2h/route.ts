import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shooters, clubs, results, disciplines, competitions, shooterFormaCache } from "@/lib/db/schema";
import { eq, inArray, isNotNull, and, asc } from "drizzle-orm";
import { currentSeasonStartYear, seasonLabel as formatSeasonLabel } from "@/lib/ranking-metrics";

export async function GET(req: NextRequest) {
  const a = parseInt(req.nextUrl.searchParams.get("a") ?? "");
  const b = parseInt(req.nextUrl.searchParams.get("b") ?? "");
  if (!a || !b || isNaN(a) || isNaN(b) || a === b) {
    return NextResponse.json({ error: "need two distinct shooter ids" }, { status: 400 });
  }

  const ids = [a, b];

  const [shooterRows, cacheRows, resultRows] = await Promise.all([
    db
      .select({ id: shooters.id, firstName: shooters.firstName, lastName: shooters.lastName, nationality: shooters.nationality, clubName: clubs.name })
      .from(shooters)
      .leftJoin(clubs, eq(shooters.clubId, clubs.id))
      .where(inArray(shooters.id, ids)),

    db
      .select({ shooterId: shooterFormaCache.shooterId, disciplineCode: shooterFormaCache.disciplineCode, forma: shooterFormaCache.forma, trend: shooterFormaCache.trend, peakCareer: shooterFormaCache.peakCareer, best3Career: shooterFormaCache.best3Career, seasonAvg: shooterFormaCache.seasonAvg, recent3Career: shooterFormaCache.recent3Career, careerCount: shooterFormaCache.careerCount })
      .from(shooterFormaCache)
      .where(inArray(shooterFormaCache.shooterId, ids)),

    db
      .select({ shooterId: results.shooterId, discCode: disciplines.code, competitionId: results.competitionId, competitionName: competitions.name, date: competitions.date, qualTotal: results.qualTotal, qualRank: results.qualRank })
      .from(results)
      .innerJoin(disciplines, eq(results.disciplineId, disciplines.id))
      .innerJoin(competitions, eq(results.competitionId, competitions.id))
      .where(and(inArray(results.shooterId, ids), isNotNull(results.qualTotal)))
      .orderBy(asc(competitions.date)),
  ]);

  function build(id: number) {
    const s = shooterRows.find((r) => r.id === id);
    if (!s) return null;
    return {
      shooterId: id,
      firstName: s.firstName,
      lastName: s.lastName,
      nationality: s.nationality,
      clubName: s.clubName,
      stats: cacheRows
        .filter((r) => r.shooterId === id)
        .map((r) => ({
          disciplineCode: r.disciplineCode,
          forma: r.forma != null ? Number(r.forma) : null,
          trend: r.trend ?? null,
          peak: r.peakCareer != null ? Number(r.peakCareer) : null,
          best3avg: r.best3Career != null ? Number(r.best3Career) : null,
          seasonAvg: r.seasonAvg != null ? Number(r.seasonAvg) : null,
          recent3avg: r.recent3Career != null ? Number(r.recent3Career) : null,
          appearances: r.careerCount ?? 0,
        })),
      matches: resultRows
        .filter((r) => r.shooterId === id)
        .map((r) => ({
          discCode: r.discCode,
          competitionId: r.competitionId,
          competitionName: r.competitionName,
          date: r.date,
          qualTotal: parseFloat(r.qualTotal!),
          qualRank: r.qualRank,
        })),
    };
  }

  const p1 = build(a);
  const p2 = build(b);
  if (!p1 || !p2) return NextResponse.json({ error: "not found" }, { status: 404 });

  const seasonLabel = formatSeasonLabel("vazdusna", currentSeasonStartYear("vazdusna"));

  return NextResponse.json({ p1, p2, seasonLabel }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
