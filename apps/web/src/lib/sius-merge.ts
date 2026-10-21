// Client-safe: bez DB importa — koristi ga i SiusMode (browser bundle).
import type { SiusExtraRemarks } from "@shootermarkt/adapters/sius/public-adapter";
import type { ReviewRow, StageRemarks } from "@shootermarkt/db/pdf-import-types";
import { buildSiusFinalDetails } from "@/lib/final-detail";

/** Only the non-empty penalty / shoot-off / record marks, or undefined when there are none. */
export function stageRemarks(r: SiusExtraRemarks): StageRemarks | undefined {
  const out: StageRemarks = {};
  if (r.penalty) out.penalty = r.penalty;
  if (r.shootOff) out.shootOff = r.shootOff;
  if (r.record) out.record = r.record;
  return Object.keys(out).length ? out : undefined;
}

export interface SiusFinalEntry extends SiusExtraRemarks {
  disciplineCode: string;
  /** Uzrasna kategorija događaja (junior za SIUS događaje sa sufiksom J); default senior. */
  category?: ReviewRow["category"];
  rank: number | null; // null = DSQ/DNS without a rank
  remark: string | null;
  firstName: string;
  lastName: string;
  nation: string;
  total: number;
  inners: number | null;
  series: number[];
  siusAthleteId: string | null;
  skip?: boolean;
}

const finalMarks = (f: SiusFinalEntry) => ({
  finalTotal: f.rank === null ? null : f.total,
  finalRank: f.rank,
  finalRemark: f.remark,
  finalShootOff: f.shootOff ? true : null,
});
const withFinal = (existing: ReviewRow["remarkDetails"], f: SiusFinalEntry) => {
  const extra = stageRemarks(f);
  return extra ? { ...existing, final: extra } : existing;
};

/** Merges SIUS finals into qualification rows (shared by admin UI and CLI import). */
export function mergeSiusFinals(rows: ReviewRow[], finalEntries: SiusFinalEntry[]): ReviewRow[] {
  const activeFinals = finalEntries.filter((f) => !f.skip);

  // Isti oblik kao live cron: kumulativ po seriji discipline + nazivi kolona + plasman posle
  // svake serije (lib/final-detail.ts), umesto čistih zbirova serija.
  const finalFields = new Map<SiusFinalEntry, Pick<ReviewRow, "finalCumulative" | "finalSeriesLabels" | "finalRanks">>();
  const sameEvent = (f: SiusFinalEntry, r: Pick<ReviewRow, "disciplineCode" | "category">) =>
    f.disciplineCode === r.disciplineCode && (f.category ?? "senior") === r.category;
  for (const event of new Set(activeFinals.map((f) => `${f.disciplineCode}|${f.category ?? "senior"}`))) {
    const [code, category] = event.split("|");
    const finalists = activeFinals.filter((f) => f.disciplineCode === code && (f.category ?? "senior") === category && f.series.length > 0).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    buildSiusFinalDetails(code, finalists).forEach((detail, i) => finalFields.set(finalists[i], {
      finalCumulative: detail.cumulative ?? null,
      finalSeriesLabels: detail.seriesLabels ?? null,
      finalRanks: detail.ranks ?? null,
    }));
  }
  const mergedRows = rows.map((r) => {
    const f = activeFinals.find(
      (fe) => sameEvent(fe, r) && (
        (fe.siusAthleteId && fe.siusAthleteId === r.issfId) ||
        (fe.lastName.toLowerCase() === r.lastName.toLowerCase() &&
         fe.firstName.toLowerCase() === r.firstName.toLowerCase())
      )
    );
    if (!f) return r;
    return {
      ...r,
      qualified: true,
      ...finalMarks(f),
      remarkDetails: withFinal(r.remarkDetails, f),
      ...finalFields.get(f),
    };
  });

  // A final can be published before its qualification table reaches SIUS.
  // Keep it importable instead of leaving this visible review row uncommitted.
  for (const f of activeFinals) {
    const matched = mergedRows.some((r) =>
      sameEvent(f, r) && (
        (f.siusAthleteId && f.siusAthleteId === r.issfId) ||
        (f.lastName.toLowerCase() === r.lastName.toLowerCase() &&
         f.firstName.toLowerCase() === r.firstName.toLowerCase())
      )
    );
    if (!matched) {
      mergedRows.push({
        issfId: f.siusAthleteId ?? undefined,
        firstName: f.firstName,
        lastName: f.lastName,
        teamNoc: f.nation,
        disciplineCode: f.disciplineCode as ReviewRow["disciplineCode"],
        category: f.category ?? "senior",
        qualTotal: null,
        qualInners: null,
        qualified: true,
        ...finalMarks(f),
        remarkDetails: withFinal(undefined, f),
        ...finalFields.get(f),
      });
    }
  }

  return mergedRows;
}
