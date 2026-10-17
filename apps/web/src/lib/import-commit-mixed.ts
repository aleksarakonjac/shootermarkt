import { db } from "@shootermarkt/db";
import { competitions, disciplines, mixedTeamResults } from "@shootermarkt/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { MixedTeamEntry } from "@/app/(site)/(admin)/admin/rezultati/_shared/MixedTeamReviewTable";
import type { CompetitionLevel, EventType, StageRemarks } from "@shootermarkt/db/pdf-import-types";

export class MixedCommitError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export interface MixedCommitEntry {
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
  /** Penalty / shoot-off / record marks of the stage being committed. */
  extras?: StageRemarks;
}

/** Shallow per-stage merge: qualification and finals are committed in separate calls. */
const mergeRemarkDetails = sql`coalesce(${mixedTeamResults.remarkDetails}, '{}'::jsonb) || coalesce(excluded.remark_details, '{}'::jsonb)`;

export interface MixedCommitInput {
  discipline: string;
  isFinals: boolean;
  entries: MixedCommitEntry[];
  competitionId?: number;
  competition?: { name: string; date: string; location?: string; level: CompetitionLevel; eventType?: EventType };
}

/** Upserts mixed-team qualification or finals rows for one discipline. */
export async function commitMixedTeamEntries(input: MixedCommitInput) {
  const { discipline: code, isFinals, entries } = input;
  if (!code || !Array.isArray(entries)) throw new MixedCommitError("Invalid payload", 400);

  // Resolve or create competition
  let competitionId: number | undefined = input.competitionId;
  if (!competitionId && input.competition) {
    const comp = input.competition;
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
    throw new MixedCommitError("competitionId or competition required", 400);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const disc = await db.query.disciplines.findFirst({ where: eq(disciplines.code, code as any) });
  if (!disc) throw new MixedCommitError("Discipline not found", 404);

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
            remarkDetails: e.extras ? { final: e.extras } : null,
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
              remarkDetails: mergeRemarkDetails,
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
            remarkDetails: e.extras ? { qual: e.extras } : null,
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
              remarkDetails: mergeRemarkDetails,
            },
          });
      }
      inserted++;
    } catch (err) {
      errors.push(`${e.nocCode}: ${String(err)}`);
    }
  }

  return { inserted, skipped, errors, competitionId };
}


/** Commits reviewed mixed-team entries (qualification, then finals) per discipline; same payloads as the admin UI. */
export async function commitMixedTeamsDirect(competitionId: number, entries: MixedTeamEntry[]) {
  let inserted = 0, skipped = 0;
  const errors: string[] = [];
  const byDiscipline = new Map<string, MixedTeamEntry[]>();
  for (const e of entries) byDiscipline.set(e.disciplineCode, [...(byDiscipline.get(e.disciplineCode) ?? []), e]);

  for (const [discipline, rows] of byDiscipline) {
    const qual = await commitMixedTeamEntries({ competitionId, discipline, isFinals: false, entries: rows.map((e) => ({
      skip: e.skip, nocCode: e.nocCode, teamNumber: e.teamNumber, qualRank: e.qualRank, qualTotal: e.qualTotal, qualInners: e.inners, qualRemark: e.qualRemark, qualified: e.qualified, extras: e.qualExtras,
      m_lastName: e.mLastName, m_firstName: e.mFirstName, m_series: e.m_series, mInners: e.mInners, mTotal: e.mTotal,
      f_lastName: e.fLastName, f_firstName: e.fFirstName, f_series: e.f_series, fInners: e.fInners, fTotal: e.fTotal,
    })) });
    inserted += qual.inserted; skipped += qual.skipped; errors.push(...qual.errors);

    const finalists = rows.filter((e) => !e.skip && e.finalRank != null);
    if (!finalists.length) continue;
    const fin = await commitMixedTeamEntries({ competitionId, discipline, isFinals: true, entries: finalists.map((e) => ({
      nocCode: e.nocCode, teamNumber: e.teamNumber, finalRank: e.finalRank, finalTotal: e.finalTotal, finalRemark: e.finalRemark, mFinalSeries: e.mFinalSeries, fFinalSeries: e.fFinalSeries, extras: e.finalExtras,
    })) });
    errors.push(...fin.errors);
  }
  return { inserted, skipped, errors };
}
