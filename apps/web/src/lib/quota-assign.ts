/** Najviše kvota koje jedan NOC može imati u jednoj disciplini (zbir kroz sva takmičenja). */
export const MAX_QUOTAS_PER_NOC = 2;

/** Po kom plasmanu se kvote dele: u finalu ili u kvalifikacijama. */
export type QuotaBasis = "final" | "qualification";

/**
 * Minimalni kvalifikacioni rezultat (MQS) za kvotu: rezultat kvalifikacija strelca na tom takmičenju mora biti jednak ili veći.
 * Izvor: IOC "LA28 Shooting Qualification System" (verzija 19.6.2026), strana 3.
 */
export const MQS: Record<string, number> = {
  ARM: 613.0, ARW: 613.0, R3PM: 569, R3PW: 567, APM: 565, APW: 560, RFPM: 565, SPW: 565,
};

/** Da li rezultat kvalifikacija zadovoljava MQS discipline (discipline bez MQS-a nemaju uslov). */
export function meetsMqs(code: string, qualTotal: number | null): boolean {
  const min = MQS[code];
  return min == null || (qualTotal != null && qualTotal >= min);
}

/**
 * Najviše kvota jedne države u jednoj disciplini na jednom takmičenju: 1 na svetskom prvenstvu, 2 na ostalim
 * kvalifikacionim takmičenjima (IOC "LA28 Shooting Qualification System", strana 7, "Special provisions").
 */
export function maxQuotasPerNocAtEvent(level: string, eventType: string): number {
  return level === "world" && eventType === "championship" ? 1 : 2;
}

/** Pomak koji kandidate iz kvalifikacija stavlja iza svih finalista. */
const QUAL_RANK_OFFSET = 1000;

/**
 * Plasman kandidata za dodelu kvote. Osnova "final": prvo finalisti po plasmanu u finalu, a ako njima nisu popunjena sva
 * mesta, redom najbolje plasirani iz kvalifikacija koji nisu bili u finalu (IOC "LA28 Shooting Qualification System", strana 7–8).
 * Osnova "qualification": samo plasman u kvalifikacijama. Bez plasmana: null (nije kandidat).
 */
export function candidateRank(basis: QuotaBasis, finalRank: number | null, qualRank: number | null): number | null {
  if (basis === "qualification") return qualRank;
  if (finalRank != null) return finalRank;
  return qualRank != null ? QUAL_RANK_OFFSET + qualRank : null;
}

/** Plasman i faza iz `candidateRank`: kandidat iz kvalifikacija (ne iz finala) ima plasman u kvalifikacijama. */
export function rankInfo(basis: QuotaBasis, finalRank: number | null, qualRank: number | null): { rank: number | null; stage: "final" | "qualification" } {
  if (basis === "qualification" || finalRank == null) return { rank: qualRank, stage: "qualification" };
  return { rank: finalRank, stage: "final" };
}

export type QuotaCandidate = { resultId: number; shooterId: number; nationality: string | null; rank: number; qualTotal?: number | null };

/**
 * Predlog dodele kvota jedne discipline na jednom takmičenju: kandidati po plasmanu, uz preskakanje
 *  - strelaca koji već imaju kvotu (strelac može osvojiti samo jednu),
 *  - NOC-ova koji su već na limitu na ovom takmičenju (`maxPerNocAtEvent`: 1 na SP, 2 drugde),
 *  - NOC-ova koji su već na limitu u disciplini kroz sva takmičenja (MAX_QUOTAS_PER_NOC),
 *  - kandidata čiji je rezultat kvalifikacija ispod MQS-a (`minScore`).
 * Ulazno stanje se ne menja.
 */
export function assignQuotas(opts: {
  places: number;
  candidates: QuotaCandidate[];
  shooterIds: ReadonlySet<number>;
  /** Kvote po NOC-u u ovoj disciplini na ovom takmičenju. */
  eventNocCounts: ReadonlyMap<string, number>;
  /** Najviše kvota jedne države na ovom takmičenju (vidi maxQuotasPerNocAtEvent). */
  maxPerNocAtEvent: number;
  /** Kvote po NOC-u u ovoj disciplini kroz sva takmičenja. */
  nocCounts: ReadonlyMap<string, number>;
  maxPerNoc?: number;
  /** MQS discipline; kandidat bez rezultata ili ispod njega ne dobija kvotu. */
  minScore?: number;
}): QuotaCandidate[] {
  const max = opts.maxPerNoc ?? MAX_QUOTAS_PER_NOC;
  const taken = new Set(opts.shooterIds);
  const eventCounts = new Map(opts.eventNocCounts);
  const counts = new Map(opts.nocCounts);
  const won: QuotaCandidate[] = [];
  for (const c of [...opts.candidates].sort((a, b) => a.rank - b.rank)) {
    if (won.length >= opts.places) break;
    if (taken.has(c.shooterId)) continue;
    if (opts.minScore != null && (c.qualTotal == null || c.qualTotal < opts.minScore)) continue;
    const noc = c.nationality;
    if (noc && ((eventCounts.get(noc) ?? 0) >= opts.maxPerNocAtEvent || (counts.get(noc) ?? 0) >= max)) continue;
    won.push(c);
    taken.add(c.shooterId);
    if (noc) {
      eventCounts.set(noc, (eventCounts.get(noc) ?? 0) + 1);
      counts.set(noc, (counts.get(noc) ?? 0) + 1);
    }
  }
  return won;
}
