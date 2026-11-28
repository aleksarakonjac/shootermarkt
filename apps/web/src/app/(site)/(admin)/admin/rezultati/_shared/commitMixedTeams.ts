// Client-safe: koristi ga i SiusMode/IssfMode (browser) i serverski uvoz (import-commit-mixed.ts).
import type { MixedCommitEntry, MixedCommitInput } from "@/lib/import-commit-mixed";
import type { MixedTeamEntry } from "./MixedTeamReviewTable";

type StageResult = { inserted?: number; skipped?: number; written?: string[]; updated?: string[]; errors?: string[] };
type StageInput = Required<Pick<MixedCommitInput, "discipline" | "category" | "isFinals" | "entries" | "eventName" | "eventDate">>;

export const toQualCommit = (e: MixedTeamEntry): MixedCommitEntry => ({
  skip: e.skip, nocCode: e.nocCode, teamNumber: e.teamNumber, qualRank: e.qualRank, qualTotal: e.qualTotal, qualInners: e.inners, qualRemark: e.qualRemark, qualified: e.qualified, extras: e.qualExtras,
  m_lastName: e.mLastName, m_firstName: e.mFirstName, mIssfId: e.mIssfId, m_series: e.m_series, mInners: e.mInners, mTotal: e.mTotal,
  f_lastName: e.fLastName, f_firstName: e.fFirstName, fIssfId: e.fIssfId, f_series: e.f_series, fInners: e.fInners, fTotal: e.fTotal,
  clubName: e.clubName, createMissing: e.createMissing, mShooterId: e.mShooterId, fShooterId: e.fShooterId, mGender: e.mGender, fGender: e.fGender,
});

// imena se u finalu ne upisuju; po njima se nalazi red tima
export const toFinalCommit = (e: MixedTeamEntry): MixedCommitEntry => ({
  nocCode: e.nocCode, teamNumber: e.teamNumber, finalRank: e.finalRank, finalTotal: e.finalTotal, finalRemark: e.finalRemark, mFinalSeries: e.mFinalSeries, fFinalSeries: e.fFinalSeries, extras: e.finalExtras,
  m_lastName: e.mLastName, m_firstName: e.mFirstName, f_lastName: e.fLastName, f_firstName: e.fFirstName,
});

/** Država tima, ili dve za par iz dve države. */
export const TEAM_NOC = /^[A-Z]{3}(\/[A-Z]{3})?$/;

/** Commits qualification, then finals, per discipline, category and match. Counts are teams, not stages. */
export async function commitMixedStages(entries: MixedTeamEntry[], commit: (input: StageInput) => Promise<StageResult>) {
  let inserted = 0, updated = 0, unchanged = 0, skipped = 0;
  const errors: string[] = [];
  const byEvent = new Map<string, MixedTeamEntry[]>();
  for (const entry of entries) {
    // država je deo ključa tima u bazi
    if (!entry.skip && !TEAM_NOC.test(entry.nocCode)) {
      errors.push(`Tim bez nacije nije upisan: ${entry.mLastName} / ${entry.fLastName}`);
      continue;
    }
    const key = `${entry.disciplineCode}|${entry.category ?? "senior"}|${entry.eventName?.trim() ?? ""}`;
    byEvent.set(key, [...(byEvent.get(key) ?? []), entry]);
  }
  for (const rows of byEvent.values()) {
    const discipline = rows[0].disciplineCode, category = rows[0].category ?? "senior";
    const eventName = rows[0].eventName?.trim() || null, eventDate = eventName ? rows[0].eventDate ?? null : null;
    let qual: StageResult;
    let finals: StageResult = {};
    try {
      qual = await commit({ discipline, category, eventName, eventDate, isFinals: false, entries: rows.map(toQualCommit) });
    } catch (error) {
      errors.push(`${discipline}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const finalists = rows.filter((e) => !e.skip && (e.finalRank != null || e.finalRemark));
    if (finalists.length) {
      try {
        finals = await commit({ discipline, category, eventName, eventDate, isFinals: true, entries: finalists.map(toFinalCommit) });
      } catch (error) {
        errors.push(`${discipline} finale: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const written = new Set([...(qual.written ?? []), ...(finals.written ?? [])]);
    // Tim upisan u kvalifikacijama kao nov ostaje "nov" i kad mu finale odmah dopuni red.
    const added = new Set((qual.written ?? []).filter((k) => !qual.updated?.includes(k)));
    const stageErrors = [...(qual.errors ?? []), ...(finals.errors ?? [])];
    inserted += written.size;
    updated += [...written].filter((k) => !added.has(k)).length;
    unchanged += Math.max(0, rows.filter((e) => !e.skip).length - written.size - stageErrors.length);
    skipped += qual.skipped ?? 0;
    errors.push(...stageErrors);
  }
  return { inserted, updated, unchanged, skipped, errors };
}

export function commitMixedTeams(competitionId: number, entries: MixedTeamEntry[]) {
  return commitMixedStages(entries, async (input) => {
    const response = await fetch("/api/admin/import/commit-mixed", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitionId, ...input }),
    });
    const data = await response.json() as StageResult & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "commit error");
    return data;
  });
}
