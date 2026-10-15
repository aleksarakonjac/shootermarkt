import type { FinalDetail } from "@shootermarkt/db/schema";

/**
 * Da li u tabeli finala prikazati zlatni/srebrni/bronzani krug oko prva tri mesta.
 * Medalje se dodeljuju tek kad je finale ZAVRŠENO, ne po trenutnom poretku.
 *
 * 1. Podaci kažu da je gotovo → da. Za sada znamo samo SIUS trostav: posle 4 serije
 *    (klečeći, ležeći, stojeći 5+5) ide 5 pojedinačnih hitaca do prvog mesta, pa je finale
 *    gotovo kad prva dvojica imaju svih 9 vrednosti.
 * 2. Po satnici finale još traje (od starta do kraja + rezerva za kašnjenje) → ne.
 * 3. Inače (završeno po satnici ili nema satnice) → da.
 */

export type FinalSlot = { startTime: string; endTime: string | null };

const OVERRUN_MS = 10 * 60_000;
const DEFAULT_FINAL_MS = 75 * 60_000;
const THREE_POSITION_ENTRIES = 4 + 5;

function looksComplete(detailsByRank: Array<FinalDetail | null>) {
  const [first, second] = detailsByRank;
  if (first?.format !== "bulletin" || second?.format !== "bulletin") return false;
  const isThreePosition = first.seriesLabels?.[0] === "Klečeći";
  return isThreePosition
    && (first.cumulative?.length ?? 0) >= THREE_POSITION_ENTRIES
    && (second.cumulative?.length ?? 0) >= THREE_POSITION_ENTRIES;
}

export function isFinalInProgress(slot: FinalSlot | undefined, now: Date) {
  if (!slot) return false;
  const start = new Date(slot.startTime).getTime();
  const end = slot.endTime ? new Date(slot.endTime).getTime() : start + DEFAULT_FINAL_MS;
  return now.getTime() >= start && now.getTime() < end + OVERRUN_MS;
}

/** `detailsByRank`: finalDetail finalista u redosledu plasmana (1., 2., …). */
export function shouldShowFinalMedals(slot: FinalSlot | undefined, detailsByRank: Array<FinalDetail | null>, now = new Date()) {
  if (looksComplete(detailsByRank)) return true;
  return !isFinalInProgress(slot, now);
}
