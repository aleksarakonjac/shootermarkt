import { commitImportReview } from "@/lib/import-commit";
import { commitMixedTeamsDirect } from "@/lib/import-commit-mixed";
import { buildSiusImport, mergeSiusFinals } from "@/lib/sius-import";
import { db } from "@shootermarkt/db";
import { competitions } from "@shootermarkt/db/schema";
import { eq } from "drizzle-orm";

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
}

export interface SiusImportResult extends SiusImportSummary {
  inserted: number;
  skipped: number;
  teamsInserted: number;
  errors: string[];
}

/**
 * Fetches a competition's SIUS results and, with `commit`, writes individual rows and mixed teams —
 * the same path as the admin SIUS mode, without the manual review step. Used by the period import
 * page and the `db:import-sius` script. Throws SiusImportError when SIUS has nothing for the UUID.
 */
export async function importSiusCompetition(competitionId: number, siusId: string, opts: { commit: true }): Promise<SiusImportResult>;
export async function importSiusCompetition(competitionId: number, siusId: string, opts?: { commit?: false }): Promise<SiusImportSummary>;
export async function importSiusCompetition(competitionId: number, siusId: string, { commit = false }: { commit?: boolean } = {}) {
  const data = await buildSiusImport(siusId);
  // SIUS kod "…J" je junior; na prvenstvima označenim U18 u nazivu to je mlađi junior.
  const [comp] = await db.select({ name: competitions.name }).from(competitions).where(eq(competitions.id, competitionId));
  if (/\bU-?18\b/i.test(comp?.name ?? "")) {
    for (const x of [...data.rows, ...data.finalEntries]) if (x.category === "junior") x.category = "mladji_junior";
  }
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
  };
  if (!commit) return summary;

  const mixed = data.teamEntries.length
    ? await commitMixedTeamsDirect(competitionId, data.teamEntries)
    : { inserted: 0, skipped: 0, errors: [] as string[] };
  const individual = rows.length
    ? await commitImportReview({ source: "sius_import", competitionId, rows })
    : { inserted: 0, skipped: 0, errors: [] as string[] };

  return {
    ...summary,
    inserted: individual.inserted,
    skipped: individual.skipped,
    teamsInserted: mixed.inserted,
    errors: [...mixed.errors, ...individual.errors],
  } satisfies SiusImportResult;
}
