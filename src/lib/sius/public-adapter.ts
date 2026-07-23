const SIUS_PUB = "https://shootingsportscloud.com:8594/api/v1/pub";

const MVP_CODES = new Set(["ARM", "ARW", "APM", "APW", "R3PM", "R3PW", "SPW", "RFPM"]);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SiusEvent {
  runningId: string;
  eventCode: string;
  name: string;
  state: string; // "Planned" | "InCompetition" | "Finished"
  startDate: string;
}

export interface SiusSubEvent {
  runningId: string;
  name: string;
  state: string;
  hidden: boolean;
}

export interface SiusLiveResult {
  rank: number;
  displayName: string;
  firstName: string;
  lastName: string;
  nation: string;       // ISO 3-letter
  total: number;
  inners: number | null; // NumberOfInnerTen — relevant for AP disciplines
  series: number[];      // per-series totals (summed shots within each group)
  siusAthleteId: string | null;
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

async function pub<T>(path: string): Promise<T> {
  const res = await fetch(`${SIUS_PUB}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`SIUS pub ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchSiusEvents(compUuid: string): Promise<SiusEvent[]> {
  const data = await pub<RawEvent[]>(
    `/competitions/events?CompetitionId=${compUuid}`
  );
  return data.map((e) => ({
    runningId: e.RunningId,
    eventCode: e.CompetitionEventType?.EventCode ?? "",
    name: e.CompetitionEventType?.Name ?? "",
    state: e.State,
    startDate: e.Startdate,
  }));
}

export async function fetchSiusSubEvents(
  compUuid: string,
  eventUuid: string
): Promise<SiusSubEvent[]> {
  const data = await pub<RawSubEvent[]>(
    `/competitions/${compUuid}/events/${eventUuid}/subevents`
  );
  return data
    .filter((s) => !s.Hidden)
    .map((s) => ({
      runningId: s.RunningId,
      name: s.Name,
      state: s.State,
      hidden: s.Hidden,
    }));
}

/** Same as fetchSiusSubEvents but includes hidden sub-events (needed for debug). */
export async function fetchSiusSubEventsAll(
  compUuid: string,
  eventUuid: string
): Promise<SiusSubEvent[]> {
  const data = await pub<RawSubEvent[]>(
    `/competitions/${compUuid}/events/${eventUuid}/subevents`
  );
  return data.map((s) => ({
    runningId: s.RunningId,
    name: s.Name,
    state: s.State,
    hidden: s.Hidden,
  }));
}

export async function fetchSiusSeries(
  compUuid: string,
  eventUuid: string,
  subEventUuid: string
): Promise<SiusLiveResult[]> {
  const raw = await pub<RawSeries | RawSeries[]>(
    `/series?runningCompetitionId=${compUuid}` +
      `&runningCompetitionEventId=${eventUuid}` +
      `&subEventId=${subEventUuid}` +
      `&shooterGroup=Regulars&teamKind=Individual`
  );

  const data: RawSeries = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  const rows = data["Series-Individual"] ?? [];
  return rows.flatMap((row) => {
    const rank = parseInt(row.Rank?.DisplayText ?? "", 10);
    if (isNaN(rank)) return [];

    const athlete = row.AthletesSeries?.[0];
    if (!athlete) return [];

    const total = athlete.TotalScore ?? 0;
    const inners =
      typeof athlete.NumberOfInnerTen === "number" ? athlete.NumberOfInnerTen : null;

    const series = parseSeriesTotals(athlete.Series ?? []);

    const { firstName, lastName } = splitDisplayName(row.DisplayName ?? "");

    return [
      {
        rank,
        displayName: row.DisplayName ?? "",
        firstName,
        lastName,
        nation: row.Nation ?? "",
        total,
        inners: inners === 0 ? null : inners, // 0 = not applicable (AR disciplines)
        series,
        siusAthleteId: athlete.AthleteIdentifier?.Identifier ?? null,
      },
    ];
  });
}

export interface SiusElimRound {
  round: number;
  results: SiusLiveResult[];
}

export interface SiusLiveData {
  qual: SiusLiveResult[];
  elim: SiusElimRound[];
  final: SiusLiveResult[];
}

function isElimSubEvent(name: string): boolean {
  return /elim/i.test(name);
}

function isFinalSubEvent(name: string): boolean {
  return /final/i.test(name);
}

function elimRoundNumber(name: string, fallback: number): number {
  const m = name.match(/(\d+)\s*$/);
  return m ? parseInt(m[1]) : fallback;
}

/**
 * Fetch all live/finished qual and elimination results for the given discipline codes.
 * Returns a map of eventCode → { qual, elim[] }.
 */
export async function fetchLiveSiusResults(
  compUuid: string,
  disciplineCodes: string[]
): Promise<Map<string, SiusLiveData>> {
  const out = new Map<string, SiusLiveData>();

  const allEvents = await fetchSiusEvents(compUuid);
  const relevantEvents = allEvents.filter((e) => disciplineCodes.includes(e.eventCode));

  await Promise.all(
    relevantEvents.map(async (event) => {
      let subEvents: SiusSubEvent[];
      try {
        subEvents = await fetchSiusSubEventsAll(compUuid, event.runningId);
      } catch {
        return;
      }

      const done = subEvents.filter((s) => s.state !== "Planned");
      // Qual: visible only (avoid hidden aggregated/combined sub-events)
      const qualSubs = done.filter((s) => !s.hidden && !isElimSubEvent(s.name) && !isFinalSubEvent(s.name));
      // Elim/final: include hidden (SIUS sometimes marks these as hidden)
      const elimSubs = done.filter((s) => isElimSubEvent(s.name));
      const finalSub = done.find((s) => isFinalSubEvent(s.name));

      const data: SiusLiveData = { qual: [], elim: [], final: [] };

      // Fetch ALL qual sub-events and merge (R3P has multiple relays)
      for (const sub of qualSubs) {
        try {
          const r = await fetchSiusSeries(compUuid, event.runningId, sub.runningId);
          data.qual.push(...r);
        } catch { /* ignore */ }
      }
      // Re-rank merged qual by total desc
      if (qualSubs.length > 1 && data.qual.length > 0) {
        data.qual.sort((a, b) => b.total - a.total || (b.inners ?? 0) - (a.inners ?? 0));
        data.qual.forEach((r, i) => { r.rank = i + 1; });
      }

      // Elimination rounds (one per sub-event, ordered by round number)
      let elimFallbackIdx = 1;
      for (const sub of elimSubs) {
        const rnd = elimRoundNumber(sub.name, elimFallbackIdx++);
        try {
          const r = await fetchSiusSeries(compUuid, event.runningId, sub.runningId);
          if (r.length > 0) data.elim.push({ round: rnd, results: r });
        } catch { /* ignore */ }
      }

      // Final sub-event
      if (finalSub) {
        try {
          data.final = await fetchSiusSeries(compUuid, event.runningId, finalSub.runningId);
        } catch { /* ignore */ }
      }

      if (data.qual.length > 0 || data.elim.length > 0) {
        const existing = out.get(event.eventCode);
        if (existing) {
          if (data.qual.length > 0) existing.qual = data.qual;
          existing.elim.push(...data.elim);
        } else {
          out.set(event.eventCode, data);
        }
      }
    })
  );

  return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSeriesTotals(
  seriesRaw: Array<Array<{ Value: string }>>
): number[] {
  // SIUS: [[{Value:"106.3"}, {Value:"105.9"}, ...]] — outer array is always len 1,
  // inner array holds one entry per series (already totalled by SIUS)
  return seriesRaw
    .flatMap((group) => group)
    .map((s) => parseFloat(s.Value))
    .filter((v) => !isNaN(v));
}

/** SIUS: "HRBEKOVA Danka" → { lastName: "HRBEKOVA", firstName: "Danka" } */
function splitDisplayName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: "", lastName: parts[0] };
  return { firstName: parts.slice(1).join(" "), lastName: parts[0] };
}

// ── Raw response types ────────────────────────────────────────────────────────

interface RawEvent {
  RunningId: string;
  CompetitionEventType?: { EventCode: string; Name: string };
  State: string;
  Startdate: string;
}

interface RawSubEvent {
  RunningId: string;
  Name: string;
  State: string;
  Hidden: boolean;
}

interface RawSeries {
  "Series-Individual"?: RawSeriesRow[];
}

interface RawSeriesRow {
  Rank?: { DisplayText: string };
  DisplayName?: string;
  Nation?: string;
  AthletesSeries?: RawAthleteSeries[];
}

interface RawAthleteSeries {
  AthleteIdentifier?: { Identifier?: string };
  TotalScore?: number;
  NumberOfInnerTen?: number;
  Series?: Array<Array<{ Order: number; Value: string }>>;
}
