import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { competitions, disciplines, mixedTeamResults } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { CompetitionLevel, EventType } from "@/lib/pdf-import/types";

function isAdmin(email: string | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
  interface QualEntry {
    skip?: boolean;
    nocCode: string;
    teamNumber?: number;
    qualRank?: number | null;
    qualTotal?: number | null;
    qualInners?: number | null;
    qualRemark?: string | null;
    qualified?: boolean | null;
    m_lastName?: string;
    m_firstName?: string;
    m_series?: number[];
    mInners?: number | null;
    mTotal?: number;
    f_lastName?: string;
    f_firstName?: string;
    f_series?: number[];
    fInners?: number | null;
    fTotal?: number;
    finalRank?: number | null;
    finalTotal?: number | null;
    finalRemark?: string | null;
    mFinalSeries?: number[];
    fFinalSeries?: number[];
  }

  const body = await req.json();
  const { discipline: code, isFinals, entries } = body as {
    discipline: string;
    isFinals: boolean;
    entries: QualEntry[];
    competitionId?: number;
    competition?: { name: string; date: string; location?: string; level: CompetitionLevel; eventType?: EventType };
  };

  if (!code || !Array.isArray(entries)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Resolve or create competition
  let competitionId: number | undefined = body.competitionId;
  if (!competitionId && body.competition) {
    const comp = body.competition;
    const existing = await db.query.competitions.findFirst({
      where: and(eq(competitions.name, comp.name), eq(competitions.date, comp.date)),
    });
    if (existing) {
      competitionId = existing.id;
    } else {
      const [ins] = await db
        .insert(competitions)
        .values({
          name: comp.name,
          date: comp.date,
          location: comp.location,
          level: comp.level,
          eventType: comp.eventType ?? "other",
        })
        .returning({ id: competitions.id });
      competitionId = ins.id;
    }
  }

  if (!competitionId) {
    return NextResponse.json({ error: "competitionId or competition required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const disc = await db.query.disciplines.findFirst({ where: eq(disciplines.code, code as any) });
  if (!disc) return NextResponse.json({ error: "Discipline not found" }, { status: 404 });

  let inserted = 0, skipped = 0;
  const errors: string[] = [];

  for (const e of entries) {
    if (e.skip) { skipped++; continue; }
    try {
      if (isFinals) {
        await db
          .insert(mixedTeamResults)
          .values({
            competitionId,
            disciplineId: disc.id,
            nocCode: e.nocCode,
            teamNumber: e.teamNumber ?? 1,
            finalRank: e.finalRank ?? null,
            finalTotal: e.finalTotal != null ? String(e.finalTotal) : null,
            finalRemark: e.finalRemark ?? null,
            shooter1FinalDetail: e.mFinalSeries?.length ? { series: e.mFinalSeries } : null,
            shooter2FinalDetail: e.fFinalSeries?.length ? { series: e.fFinalSeries } : null,
            source: "manual",
          })
          .onConflictDoUpdate({
            target: [mixedTeamResults.competitionId, mixedTeamResults.disciplineId, mixedTeamResults.nocCode, mixedTeamResults.teamNumber],
            set: {
              finalRank: e.finalRank ?? null,
              finalTotal: e.finalTotal != null ? String(e.finalTotal) : null,
              finalRemark: e.finalRemark ?? null,
              shooter1FinalDetail: e.mFinalSeries?.length ? { series: e.mFinalSeries } : null,
              shooter2FinalDetail: e.fFinalSeries?.length ? { series: e.fFinalSeries } : null,
            },
          });
      } else {
        await db
          .insert(mixedTeamResults)
          .values({
            competitionId,
            disciplineId: disc.id,
            nocCode: e.nocCode,
            teamNumber: e.teamNumber ?? 1,
            shooter1Name: `${e.m_lastName} ${e.m_firstName}`.trim() || null,
            shooter2Name: `${e.f_lastName} ${e.f_firstName}`.trim() || null,
            shooter1Detail: { series: e.m_series ?? [], inners: e.mInners ?? null, total: e.mTotal ?? 0 },
            shooter2Detail: { series: e.f_series ?? [], inners: e.fInners ?? null, total: e.fTotal ?? 0 },
            qualRank: e.qualRank ?? null,
            qualTotal: e.qualTotal != null ? String(e.qualTotal) : null,
            qualInners: e.qualInners ?? null,
            qualRemark: e.qualRemark ?? null,
            qualified: e.qualified ?? null,
            source: "manual",
          })
          .onConflictDoUpdate({
            target: [mixedTeamResults.competitionId, mixedTeamResults.disciplineId, mixedTeamResults.nocCode, mixedTeamResults.teamNumber],
            set: {
              shooter1Name: `${e.m_lastName} ${e.m_firstName}`.trim() || null,
              shooter2Name: `${e.f_lastName} ${e.f_firstName}`.trim() || null,
              shooter1Detail: { series: e.m_series ?? [], inners: e.mInners ?? null, total: e.mTotal ?? 0 },
              shooter2Detail: { series: e.f_series ?? [], inners: e.fInners ?? null, total: e.fTotal ?? 0 },
              qualRank: e.qualRank ?? null,
              qualTotal: e.qualTotal != null ? String(e.qualTotal) : null,
              qualInners: e.qualInners ?? null,
              qualRemark: e.qualRemark ?? null,
              qualified: e.qualified ?? null,
            },
          });
      }
      inserted++;
    } catch (err) {
      errors.push(`${e.nocCode}: ${String(err)}`);
    }
  }

    return NextResponse.json({ inserted, skipped, errors, competitionId });
  } catch (error) {
    console.error("Mixed-team import commit failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mixed-team commit failed" }, { status: 500 });
  }
}
