import { db } from "@shootermarkt/db";
import { competitions, disciplines, mixedTeamResults } from "@shootermarkt/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { MixedTeamEntry } from "@/app/(site)/(admin)/admin/rezultati/_shared/MixedTeamReviewTable";
import { eventTypeFromName } from "@/lib/competition-filters";
import { changedColumns, changedParts, type ImportStatus } from "@/lib/import-diff";
import { commitMixedStages, toFinalCommit, toQualCommit } from "@/app/(site)/(admin)/admin/rezultati/_shared/commitMixedTeams";
import { isUnrankedRemark, type CompetitionLevel, type EventType, type StageRemarks } from "@shootermarkt/db/pdf-import-types";

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
const mergeRemarkDetails = sql`coalesce(${mixedTeamResults.remarkDetails} || excluded.remark_details, excluded.remark_details, ${mixedTeamResults.remarkDetails})`;

/** Kolone koje upisuje jedna faza (bez ključa, `remarkDetails` i `source`). */
function stageColumns(e: MixedCommitEntry, isFinals: boolean) {
  if (isFinals) {
    return {
      finalRank: e.finalRank ?? null,
      finalTotal: e.finalTotal != null ? String(e.finalTotal) : null,
      finalRemark: e.finalRemark ?? null,
      shooter1FinalDetail: e.mFinalSeries?.length ? { series: e.mFinalSeries } : null,
      shooter2FinalDetail: e.fFinalSeries?.length ? { series: e.fFinalSeries } : null,
    };
  }
  return {
    shooter1Name: `${e.m_lastName} ${e.m_firstName}`.trim() || null,
    shooter2Name: `${e.f_lastName} ${e.f_firstName}`.trim() || null,
    shooter1Detail: { series: e.m_series ?? [], inners: e.mInners ?? null, total: e.mTotal ?? 0 },
    shooter2Detail: { series: e.f_series ?? [], inners: e.fInners ?? null, total: e.fTotal ?? 0 },
    qualRank: isUnrankedRemark(e.qualRemark) ? null : e.qualRank ?? null,
    qualTotal: e.qualTotal != null ? String(e.qualTotal) : null,
    qualInners: e.qualInners ?? null,
    qualRemark: e.qualRemark ?? null,
    qualified: e.qualified ?? null,
  };
}

const teamKey = (nocCode: string, teamNumber: number | undefined) => `${nocCode}#${teamNumber ?? 1}`;

async function loadTeams(competitionId: number, disciplineId: number, category: NonNullable<MixedCommitInput["category"]>) {
  const rows = await db.select().from(mixedTeamResults).where(and(
    eq(mixedTeamResults.competitionId, competitionId), eq(mixedTeamResults.disciplineId, disciplineId), eq(mixedTeamResults.category, category),
  ));
  return new Map<string, Record<string, unknown>>(rows.map((r) => [teamKey(r.nocCode, r.teamNumber), r]));
}

/** Kolone koje bi se promenile upisom faze u postojeći red tima. */
function teamChanges(old: Record<string, unknown>, e: MixedCommitEntry, isFinals: boolean) {
  const remarkDetails = e.extras
    ? { ...(old.remarkDetails as object | null), [isFinals ? "final" : "qual"]: e.extras }
    : old.remarkDetails;
  return changedColumns(old, { ...stageColumns(e, isFinals), remarkDetails });
}

/** Šta bi uvoz uradio sa svakim mešovitim timom, bez ijednog upisa. */
export async function previewMixedTeams(competitionId: number, entries: MixedTeamEntry[]): Promise<{ status: ImportStatus; changes: string[] }[]> {
  const disciplineIds = new Map<string, number>((await db.select().from(disciplines)).map((d) => [d.code, d.id]));
  const rows = await db.select().from(mixedTeamResults).where(eq(mixedTeamResults.competitionId, competitionId));
  return entries.map((e) => {
    const old = rows.find((r) => r.disciplineId === disciplineIds.get(e.disciplineCode) && r.category === (e.category ?? "senior")
      && r.nocCode === e.nocCode && r.teamNumber === e.teamNumber);
    if (!old) return { status: "new", changes: [] };
    const columns = teamChanges(old, toQualCommit(e), false);
    if (e.finalRank != null) columns.push(...teamChanges(old, toFinalCommit(e), true));
    const changes = changedParts(columns);
    return { status: changes.length ? "changed" : "same", changes };
  });
}

export interface MixedCommitInput {
  discipline: string;
  /** Senior i junior mixed team su odvojeni događaji iste discipline. */
  category?: typeof mixedTeamResults.$inferInsert["category"];
  isFinals: boolean;
  entries: MixedCommitEntry[];
  competitionId?: number;
  competition?: { name: string; date: string; location?: string; level: CompetitionLevel; eventType?: EventType };
}

/** Upserts mixed-team qualification or finals rows for one discipline. */
export async function commitMixedTeamEntries(input: MixedCommitInput) {
  const { discipline: code, isFinals, entries } = input;
  const category = input.category ?? "senior";
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
          eventType: comp.eventType && comp.eventType !== "other" ? comp.eventType : eventTypeFromName(comp.name),
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

  let inserted = 0, skipped = 0, unchanged = 0;
  /** Timovi upisani u ovoj fazi (novi ili izmenjeni) — pozivalac spaja kvalifikacije i finale. */
  const written: string[] = [], updated: string[] = [];
  const errors: string[] = [];
  const existing = await loadTeams(competitionId, disc.id, category);

  for (const e of entries) {
    if (e.skip) { skipped++; continue; }
    try {
      const key = teamKey(e.nocCode, e.teamNumber);
      const old = existing.get(key);
      if (old && teamChanges(old, e, isFinals).length === 0) { unchanged++; continue; }
      const columns = stageColumns(e, isFinals);
      await db
        .insert(mixedTeamResults)
        .values({
          competitionId,
          disciplineId: disc.id,
          category,
          nocCode: e.nocCode,
          teamNumber: e.teamNumber ?? 1,
          ...columns,
          remarkDetails: e.extras ? { [isFinals ? "final" : "qual"]: e.extras } : null,
          source: "manual",
        })
        .onConflictDoUpdate({
          target: [mixedTeamResults.competitionId, mixedTeamResults.disciplineId, mixedTeamResults.category, mixedTeamResults.nocCode, mixedTeamResults.teamNumber],
          set: { ...columns, remarkDetails: mergeRemarkDetails },
        });
      inserted++;
      written.push(key);
      if (old) updated.push(key);
    } catch (err) {
      errors.push(`${e.nocCode}: ${String(err)}`);
    }
  }

  return { inserted, skipped, unchanged, written, updated, errors, competitionId };
}


/** Commits reviewed mixed-team entries (qualification, then finals) per discipline; same payloads as the admin UI. */
export async function commitMixedTeamsDirect(competitionId: number, entries: MixedTeamEntry[]) {
  return commitMixedStages(entries, (input) => commitMixedTeamEntries({ competitionId, ...input }));
}
