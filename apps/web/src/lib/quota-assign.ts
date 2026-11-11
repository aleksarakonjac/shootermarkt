/** Najviše kvota koje jedan NOC može imati u jednoj disciplini (zbir kroz sva takmičenja). */
export const MAX_QUOTAS_PER_NOC = 2;

/** Po kom plasmanu se kvote dele: u finalu ili u kvalifikacijama. */
export type QuotaBasis = "final" | "qualification";

export type QuotaCandidate = { resultId: number; shooterId: number; nationality: string | null; rank: number };

/**
 * Predlog dodele kvota jedne discipline na jednom takmičenju: kandidati po plasmanu, uz preskakanje
 *  - strelaca koji već imaju kvotu (strelac može osvojiti samo jednu),
 *  - NOC-ova koji su već uzeli kvotu u ovoj disciplini na ovom takmičenju (jedan strelac države po nastupu),
 *  - NOC-ova koji su već na limitu u disciplini kroz sva takmičenja (MAX_QUOTAS_PER_NOC).
 * Ulazno stanje se ne menja.
 */
export function assignQuotas(opts: {
  places: number;
  candidates: QuotaCandidate[];
  shooterIds: ReadonlySet<number>;
  /** NOC-ovi koji već imaju kvotu u ovoj disciplini na ovom takmičenju. */
  eventNocs: ReadonlySet<string>;
  /** Kvote po NOC-u u ovoj disciplini kroz sva takmičenja. */
  nocCounts: ReadonlyMap<string, number>;
  maxPerNoc?: number;
}): QuotaCandidate[] {
  const max = opts.maxPerNoc ?? MAX_QUOTAS_PER_NOC;
  const taken = new Set(opts.shooterIds);
  const eventNocs = new Set(opts.eventNocs);
  const counts = new Map(opts.nocCounts);
  const won: QuotaCandidate[] = [];
  for (const c of [...opts.candidates].sort((a, b) => a.rank - b.rank)) {
    if (won.length >= opts.places) break;
    if (taken.has(c.shooterId)) continue;
    const noc = c.nationality;
    if (noc && (eventNocs.has(noc) || (counts.get(noc) ?? 0) >= max)) continue;
    won.push(c);
    taken.add(c.shooterId);
    if (noc) {
      eventNocs.add(noc);
      counts.set(noc, (counts.get(noc) ?? 0) + 1);
    }
  }
  return won;
}
