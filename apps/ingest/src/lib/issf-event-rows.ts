import {
  extractMvpEvents,
  fetchElimResultsFromHtml,
  fetchFinalResultsFromHtml,
  fetchQualResultsFromHtml,
  fetchR3PResultsFromHtml,
} from "@shootermarkt/adapters/issf/adapter";
import { deriveFinalRankProgression, type ReviewRow } from "@shootermarkt/db/pdf-import-types";

type Event = ReturnType<typeof extractMvpEvents>[number];
type Athlete = { issfId: string; firstName: string; lastName: string; nationCode: string };

const isElimination = (title: string) => /elimination/i.test(title);

/** Review rows of one individual ISSF event: eliminations, qualification and final. */
export async function buildIssfEventRows(
  competitionId: number,
  { disciplineCode, category, qualPhase, finalPhase, elimPhases }: Event,
  resolveShooter: (athlete: Athlete) => number | undefined,
): Promise<ReviewRow[]> {
  const isR3P = disciplineCode === "R3PM" || disciplineCode === "R3PW";
  const phases = elimPhases.map((e) => ({ round: e.round, ...e.phase })).filter((p) => p.resultKey);

  // Kvalifikacije su jedna tabela "Qualification" ili više "(Qualification) Relay N" grupa — nikad eliminacije
  const relays = phases.filter((p) => !isElimination(p.title));
  const single = qualPhase?.resultKey && !isElimination(qualPhase.title) ? qualPhase : null;
  const qualPhases = single && (/^qualification$/i.test(single.title) || !relays.length) ? [single] : relays;

  const rows: ReviewRow[] = [];
  const byIssfId = new Map<string, ReviewRow>();

  function addRow(athlete: Athlete) {
    const shooterId = resolveShooter(athlete);
    const row: ReviewRow = {
      shooterId,
      issfId: athlete.issfId || undefined,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      teamNoc: athlete.nationCode,
      disciplineCode,
      category,
      qualTotal: null,
      finalTotal: null,
      finalRank: null,
      warning: shooterId ? undefined : "Novi strelac — biće kreiran",
    };
    rows.push(row);
    byIssfId.set(athlete.issfId, row);
    return row;
  }

  // Neobjavljena faza (greška pri preuzimanju) ne ruši uvoz ostalih
  const fetched = <T>(request: Promise<T[]>) => request.catch((): T[] => []);

  const qualResults = (await Promise.all(qualPhases.map(async (p) => isR3P
    ? (await fetched(fetchR3PResultsFromHtml(competitionId, p.resultKey))).map(({ kneeling, prone, standing, ...r }) =>
        ({ ...r, scores: { qualPositions: { kneeling, prone, standing } } }))
    : (await fetched(fetchQualResultsFromHtml(competitionId, p.resultKey))).map(({ series, ...r }) =>
        ({ ...r, scores: { qualSeries: series } }))))).flat();

  if (qualPhases.length > 1) {
    qualResults.sort((a, b) => b.total - a.total || (b.inners ?? 0) - (a.inners ?? 0));
    qualResults.forEach((r, i) => { r.rank = i + 1; });
  }

  for (const r of qualResults) {
    Object.assign(addRow(r), {
      qualTotal: r.total, qualInners: r.inners, qualRank: r.rank, qualified: r.qualified, remark: r.remark, ...r.scores,
    });
  }

  for (const p of phases.filter((p) => isElimination(p.title)).sort((a, b) => a.round - b.round)) {
    for (const r of await fetched(fetchElimResultsFromHtml(competitionId, p.resultKey))) {
      Object.assign(byIssfId.get(r.issfId) ?? addRow(r), {
        elimRound: p.round, elimTotal: Math.round(r.total), elimInners: r.inners, elimRank: r.rank,
        elimSeries: r.series.map(Math.round), elimRemark: r.remark,
      });
    }
  }

  if (finalPhase?.resultKey) {
    const finalResults = await fetched(fetchFinalResultsFromHtml(competitionId, finalPhase.resultKey));
    const allCumulatives = finalResults.map((f) => f.stageCumulatives);
    for (const finalist of finalResults) {
      const row = byIssfId.get(finalist.issfId);
      if (!row) continue;
      Object.assign(row, {
        finalRank: finalist.rank,
        finalTotal: finalist.total,
        finalCumulative: finalist.stageCumulatives,
        finalRanks: deriveFinalRankProgression(finalist.stageCumulatives, allCumulatives),
        finalShotsByStage: finalist.shotsByStage,
        finalShootOff: finalist.shootOff || null,
        // AR/AP/R3P finala se boduju decimalno (hit_count je samo 25m pištolj).
        finalScoring: "decimal",
        qualified: true,
      });
    }
  }

  return rows;
}
