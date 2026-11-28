// Poređenje uvoza sa onim što je već u bazi: šta je novo, šta bi se promenilo, šta je već uneto.
// Čiste funkcije (bez DB-a). upsertedResult mora da prati onConflictDoUpdate u import-commit.ts.
import { isDeepStrictEqual } from "node:util";
import type { results } from "@shootermarkt/db/schema";
import { isUnrankedRemark, type ReviewRow } from "@shootermarkt/db/pdf-import-types";

export type ImportStatus = "new" | "changed" | "same";

export interface ImportDiff {
  added: number;
  changed: number;
  same: number;
  /** Samo novi i izmenjeni; `changes` = delovi rezultata koji se razlikuju. */
  items: { label: string; status: Exclude<ImportStatus, "same">; changes: string[] }[];
}

type ResultInsert = typeof results.$inferInsert;
export type ResultColumns = ReturnType<typeof resultColumns>;

/** Kolone tabele results koje proizlaze iz reda uvoza (bez ključeva i kluba). */
export function resultColumns(row: ReviewRow) {
  const isElimOnly = row.elimRound != null && row.qualTotal == null;
  // Red samo sa eliminacijama ne dira qualRemark.
  const remarks: { qualRemark?: string | null; elimRemark: string | null } = isElimOnly
    ? { elimRemark: row.elimRemark ?? row.remark ?? null }
    : { qualRemark: row.remark ?? null, elimRemark: row.elimRemark ?? null };
  return {
    qualTotal: row.qualTotal?.toString() ?? null, qualInners: row.qualInners ?? null, qualRank: isUnrankedRemark(row.remark) ? null : row.qualRank ?? null,
    qualDetail: (row.qualEscSolo ? row.qualEscSolo : row.qualPositions
      ? { kneeling: row.qualPositions.kneeling, prone: row.qualPositions.prone, standing: row.qualPositions.standing }
      : row.qualSeries ? { series: row.qualSeries } : null) as ResultInsert["qualDetail"],
    qualified: row.qualified ?? null,
    elimRound: row.elimRound ?? null, elimTotal: row.elimTotal != null ? Math.round(row.elimTotal) : null,
    elimRank: row.elimRank ?? null,
    elimDetail: row.elimSeries || row.elimInners != null
      ? { ...(row.elimSeries ? { series: row.elimSeries.map(Math.round) } : { series: [] }), inners: row.elimInners ?? null } : null,
    finalTotal: row.finalTotal?.toString() ?? null, finalRank: row.finalRank ?? null,
    finalDetail: row.finalSeries || row.finalShots || row.finalCumulative || row.finalShotsByStage
      ? { format: "bulletin" as const, scoring: (row.finalScoring ?? "decimal") as "decimal" | "hit_count",
          ...(row.finalSeries ? { series: row.finalSeries } : {}), ...(row.finalSeriesLabels ? { seriesLabels: row.finalSeriesLabels } : {}),
          ...(row.finalShots ? { shots: row.finalShots } : {}), ...(row.finalShotsByStage ? { shotsByStage: row.finalShotsByStage } : {}),
          ...(row.finalCumulative ? { cumulative: row.finalCumulative } : {}), ...(row.finalRanks ? { ranks: row.finalRanks } : {}),
          ...(row.finalShootOff ? { shootOff: true } : {}),
          ...(row.finalOpponentTotal != null ? { opponentTotal: row.finalOpponentTotal, opponentName: row.finalOpponentName ?? null } : {}) } : null,
    ...remarks,
    finalRemark: row.finalRemark ?? null,
    remarkDetails: row.remarkDetails ?? null,
  };
}

const mergeRemarks = <T extends object>(old: T | null | undefined, next: T | null | undefined): T | null =>
  next ? { ...(old ?? {}), ...next } as T : old ?? null;

/** Vrednosti postojećeg reda posle upsert-a — samo kolone koje upsert dira (`source` se ne računa kao razlika). */
export function upsertedResult(old: Record<string, unknown>, v: ResultColumns & { clubId?: number | null }, isElimOnly: boolean): Record<string, unknown> {
  const remarkDetails = mergeRemarks(old.remarkDetails as object | null, v.remarkDetails);
  if (isElimOnly) {
    return { elimRound: v.elimRound, elimTotal: v.elimTotal, elimRank: v.elimRank, elimDetail: v.elimDetail, elimRemark: v.elimRemark, remarkDetails };
  }
  const keep = (key: keyof ResultColumns | "clubId") => v[key] ?? old[key];
  return {
    clubId: keep("clubId"),
    qualTotal: v.qualTotal, qualInners: v.qualInners, qualRank: v.qualRank, qualDetail: v.qualDetail, qualified: keep("qualified"),
    finalTotal: v.finalTotal, finalRank: v.finalRank, finalDetail: v.finalDetail,
    qualRemark: v.qualRemark, finalRemark: v.finalRemark,
    elimRound: keep("elimRound"), elimTotal: keep("elimTotal"), elimRank: keep("elimRank"), elimDetail: keep("elimDetail"), elimRemark: keep("elimRemark"),
    remarkDetails,
  };
}

const DECIMAL_COLUMNS = new Set(["qualTotal", "finalTotal"]);
// jsonb: JSON round-trip izbacuje undefined; redosled ključeva nije bitan (isDeepStrictEqual).
const normalize = (key: string, v: unknown) =>
  v == null ? null : DECIMAL_COLUMNS.has(key) ? Number(v).toFixed(1) : JSON.parse(JSON.stringify(v));

/** Kolone iz `next` čija se vrednost razlikuje od postojeće. */
export const changedColumns = (old: Record<string, unknown>, next: Record<string, unknown>): string[] =>
  Object.keys(next).filter((k) => !isDeepStrictEqual(normalize(k, old[k]), normalize(k, next[k])));

const partOf = (column: string) =>
  column === "clubId" ? "klub"
  : column === "remarkDetails" ? "oznake"
  : /final/i.test(column) ? "finale"
  : column.startsWith("elim") ? "eliminacije"
  : "kvalifikacije";

/** Imena kolona → delovi rezultata za prikaz adminu. */
export const changedParts = (columns: string[]): string[] => [...new Set(columns.map(partOf))];

export type MatchDateConflict = { name: string; existing: string; entered: string };

/** Mečevi se prepoznaju po nazivu i imaju jedan datum: postojeći naziv sa drugim datumom zadržava stari. */
export function matchDateConflicts(events: { name: string; date: string }[], entries: { eventName?: string | null; eventDate?: string | null }[]): MatchDateConflict[] {
  const dates = new Map(events.map((e) => [e.name, e.date]));
  const found = new Map<string, MatchDateConflict>();
  for (const { eventName, eventDate } of entries) {
    const name = eventName?.trim();
    const existing = name ? dates.get(name) : undefined;
    if (name && existing && eventDate && eventDate !== existing) found.set(`${name}|${eventDate}`, { name, existing, entered: eventDate });
  }
  return [...found.values()];
}

export function summarizeDiff(entries: { label: string; status: ImportStatus; changes: string[] }[]): ImportDiff {
  const diff: ImportDiff = { added: 0, changed: 0, same: 0, items: [] };
  for (const { label, status, changes } of entries) {
    if (status === "same") { diff.same++; continue; }
    diff[status === "new" ? "added" : "changed"]++;
    diff.items.push({ label, status, changes });
  }
  return diff;
}
