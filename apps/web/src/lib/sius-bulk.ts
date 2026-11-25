import { commitImportReview, previewImportRows } from "@/lib/import-commit";
import { commitMixedTeamsDirect, previewMixedTeams } from "@/lib/import-commit-mixed";
import { buildSiusImport, mergeSiusFinals } from "@/lib/sius-import";
import { summarizeDiff, type ImportDiff } from "@/lib/import-diff";
import type { ReviewRow } from "@shootermarkt/db/pdf-import-types";
import type { MixedTeamEntry } from "@/app/(site)/(admin)/admin/rezultati/_shared/MixedTeamReviewTable";

export interface SiusImportSummary {
  rows: number;
  perDiscipline: Record<string, number>;
  teams: number;
  newShooters: number;
  /** DSQ/DNS rows SIUS left without a rank. */
  unranked: number;
  /** Rows carrying a penalty, shoot-off or record mark. */
  withMarks: number;
  warnings: string[];
  /** Poređenje sa bazom pre upisa: novi / izmenjeni / već uneti (pojedinačni i timovi). */
  diff: ImportDiff;
}

export interface SiusImportResult extends SiusImportSummary {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  teamsInserted: number;
  errors: string[];
}

/** Šta bi uvoz redova (sa već spojenim finalima) i timova uradio bazi, bez upisa. */
export async function diffSiusImport(competitionId: number, rows: ReviewRow[], teams: MixedTeamEntry[]) {
  const [individual, mixed] = await Promise.all([
    previewImportRows(competitionId, rows),
    teams.length ? previewMixedTeams(competitionId, teams) : [],
  ]);
  const event = (code: string, category: string | undefined, name?: string | null) =>
    [code, category && category !== "senior" ? category : null, name].filter(Boolean).join(" · ");
  return summarizeDiff([
    ...rows.map((r, i) => ({ label: `${r.lastName} ${r.firstName} (${r.teamNoc}) · ${event(r.disciplineCode, r.category, r.eventName)}`, ...individual[i] })),
    ...teams.map((t, i) => ({ label: `Tim ${t.nocCode} ${t.teamNumber} · ${event(t.disciplineCode, t.category)}`, ...mixed[i] })),
  ]);
}

/**
 * Fetches a competition's SIUS results and, with `commit`, writes individual rows and mixed teams —
 * the same path as the admin SIUS mode, without the manual review step. Used by the period import
 * page and the `db:import-sius` script. Throws SiusImportError when SIUS has nothing for the UUID.
 */
export async function importSiusCompetition(competitionId: number, siusId: string, opts: { commit: true }): Promise<SiusImportResult>;
export async function importSiusCompetition(competitionId: number, siusId: string, opts?: { commit?: false }): Promise<SiusImportSummary>;
export async function importSiusCompetition(competitionId: number, siusId: string, { commit = false }: { commit?: boolean } = {}) {
  const data = await buildSiusImport(siusId, undefined, competitionId);
  const rows = mergeSiusFinals(data.rows, data.finalEntries);
  const perDiscipline: Record<string, number> = {};
  for (const r of rows) perDiscipline[r.disciplineCode] = (perDiscipline[r.disciplineCode] ?? 0) + 1;

  const summary: SiusImportSummary = {
    rows: rows.length,
    perDiscipline,
    teams: data.teamEntries.length,
    newShooters: rows.filter((r) => !r.shooterId).length,
    unranked: rows.filter((r) => r.qualRank == null && r.finalRank == null && r.elimRank == null).length,
    withMarks: rows.filter((r) => r.remarkDetails).length,
    warnings: data.errors,
    diff: await diffSiusImport(competitionId, rows, data.teamEntries),
  };
  if (!commit) return summary;

  const mixed = data.teamEntries.length
    ? await commitMixedTeamsDirect(competitionId, data.teamEntries)
    : { inserted: 0, updated: 0, unchanged: 0, skipped: 0, errors: [] as string[] };
  const individual = rows.length
    ? await commitImportReview({ source: "sius_import", competitionId, rows })
    : { inserted: 0, updated: 0, unchanged: 0, skipped: 0, errors: [] as string[] };

  return {
    ...summary,
    inserted: individual.inserted,
    updated: individual.updated,
    unchanged: individual.unchanged + mixed.unchanged,
    skipped: individual.skipped,
    teamsInserted: mixed.inserted,
    errors: [...mixed.errors, ...individual.errors],
  } satisfies SiusImportResult;
}
