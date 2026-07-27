import type { MixedTeamEntry } from "./MixedTeamReviewTable";

type CommitResult = { inserted?: number; skipped?: number; errors?: string[] };

/** Commit qualification and finals for each mixed-team discipline. */
export async function commitMixedTeams(competitionId: number, entries: MixedTeamEntry[]) {
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];
  const byDiscipline = new Map<string, MixedTeamEntry[]>();
  for (const entry of entries) {
    const group = byDiscipline.get(entry.disciplineCode) ?? [];
    group.push(entry);
    byDiscipline.set(entry.disciplineCode, group);
  }
  for (const [discipline, rows] of byDiscipline) {
    const qualification = await fetch("/api/admin/import/commit-mixed", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitionId, discipline, isFinals: false, entries: rows.map((e) => ({
        skip: e.skip, nocCode: e.nocCode, teamNumber: e.teamNumber, qualRank: e.qualRank, qualTotal: e.qualTotal, qualInners: e.inners, qualRemark: e.qualRemark, qualified: e.qualified,
        m_lastName: e.mLastName, m_firstName: e.mFirstName, m_series: e.m_series, mInners: e.mInners, mTotal: e.mTotal,
        f_lastName: e.fLastName, f_firstName: e.fFirstName, f_series: e.f_series, fInners: e.fInners, fTotal: e.fTotal,
      })) }),
    });
    const qualData = await qualification.json() as CommitResult & { error?: string };
    if (!qualification.ok) { errors.push(qualData.error ?? `${discipline}: commit error`); continue; }
    inserted += qualData.inserted ?? 0; skipped += qualData.skipped ?? 0; errors.push(...(qualData.errors ?? []));
    const finalists = rows.filter((e) => !e.skip && e.finalRank != null);
    if (!finalists.length) continue;
    const finals = await fetch("/api/admin/import/commit-mixed", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitionId, discipline, isFinals: true, entries: finalists.map((e) => ({ nocCode: e.nocCode, teamNumber: e.teamNumber, finalRank: e.finalRank, finalTotal: e.finalTotal, finalRemark: e.finalRemark })) }),
    });
    const finalData = await finals.json() as CommitResult & { error?: string };
    if (!finals.ok) errors.push(finalData.error ?? `${discipline}: finals commit error`);
    else errors.push(...(finalData.errors ?? []));
  }
  return { inserted, skipped, errors };
}
