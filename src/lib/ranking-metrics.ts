import type { CompetitionLevel } from "@/lib/forma";

/**
 * Sezonski prozori za statistike koje nisu forma-prognoza (sezona prosek, napredak).
 * Peak / best-3 / poslednja-3 su namerno karijerni (bez sezonskog prozora) — pitanje
 * "koji je moj najbolji rezultat ikad" ne zavisi od toga koju sezonu gledaš.
 */
export type SeasonType = "vazdusna" | "kalendarska";

/** Minimalan broj nastupa da bi statistika (osim peak-a) bila prikazana — sprečava
 * da 1 rezultat izgleda kao "prosek". Forma ima sopstveni prag (RANKING_MIN_SAMPLE=5). */
export const METRIC_MIN_SAMPLE = 3;

export function currentSeasonStartYear(type: SeasonType, today: Date = new Date()): number {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  if (type === "kalendarska") return y;
  // Vazdušna sezona: okt–maj. Jan–sep pripada sezoni koja je počela prethodnog okt.
  return m >= 10 ? y : y - 1;
}

export function seasonWindow(type: SeasonType, startYear: number): { from: string; to: string } {
  if (type === "kalendarska") return { from: `${startYear}-01-01`, to: `${startYear}-12-31` };
  return { from: `${startYear}-10-01`, to: `${startYear + 1}-09-30` };
}

export function seasonLabel(type: SeasonType, startYear: number): string {
  if (type === "kalendarska") return String(startYear);
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function inWindow(date: string, win: { from: string; to: string }): boolean {
  return date >= win.from && date <= win.to;
}

export type MetricEntry = { qualTotal: number; date: string; level: CompetitionLevel };

/** Prosek N najboljih rezultata (po skoru), karijerno. */
export function computeAvgOfTopN(entries: MetricEntry[], n: number): number | null {
  if (entries.length < METRIC_MIN_SAMPLE) return null;
  const top = [...entries].sort((a, b) => b.qualTotal - a.qualTotal).slice(0, n);
  return top.reduce((s, e) => s + e.qualTotal, 0) / top.length;
}

/** Prosek N hronološki najskorijih rezultata, karijerno. */
export function computeRecentAvg(entries: MetricEntry[], n: number): number | null {
  if (entries.length < METRIC_MIN_SAMPLE) return null;
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const recent = sorted.slice(0, n);
  return recent.reduce((s, e) => s + e.qualTotal, 0) / recent.length;
}

/** Prosek rezultata unutar sezonskog prozora. count < MIN_SAMPLE → avg je null (nepouzdano). */
export function computeSeasonAvg(
  entries: MetricEntry[],
  win: { from: string; to: string }
): { avg: number | null; count: number } {
  const inSeason = entries.filter((e) => inWindow(e.date, win));
  if (inSeason.length < METRIC_MIN_SAMPLE) return { avg: null, count: inSeason.length };
  return { avg: inSeason.reduce((s, e) => s + e.qualTotal, 0) / inSeason.length, count: inSeason.length };
}
